'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { useTaskStore } from '@/stores/task-store';
import { useActivityStore } from '@/stores/activity-store';
import { useChatStore } from '@/stores/chat-store';
import { useGatewayStore } from '@/stores/gateway-store';
import { useChat } from '@/lib/gateway/hooks';
import { loadPersistedMessages } from '@/lib/messages';
import { detectArtifacts, type DetectedArtifact } from '@/lib/artifacts/detector';
import { persistArtifacts } from '@/lib/artifacts/persistence';
import { mapChatEventToActivity, mapAgentEventToActivity } from '@/lib/gateway/activity-mapper';
import { TaskList } from '@/components/tasks/task-list';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { ArtifactPanel } from '@/components/artifacts/artifact-panel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FolderOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ChatEventPayload, AgentEventPayload } from '@/lib/gateway/types';
import { getGatewayClient } from '@/lib/gateway/hooks';

// Stable empty arrays to avoid re-render loops from new references
const EMPTY_TASKS: ReturnType<typeof useTaskStore.getState>['tasksByProject'][string] = [];
const EMPTY_ENTRIES: ReturnType<typeof useActivityStore.getState>['entriesByTask'][string] = [];

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const setMessages = useChatStore((s) => s.setMessages);

  // Task state — use stable empty array to prevent re-render loops
  const tasks = useTaskStore((s) => s.tasksByProject[projectId] ?? EMPTY_TASKS);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const createTask = useTaskStore((s) => s.createTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const selectTask = useTaskStore((s) => s.selectTask);
  const cancelTask = useTaskStore((s) => s.cancelTask);

  // Activity state — use stable empty array
  const activityEntries = useActivityStore((s) =>
    selectedTaskId ? (s.entriesByTask[selectedTaskId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES,
  );
  const isStreaming = useActivityStore((s) =>
    selectedTaskId ? s.streamingTaskIds.has(selectedTaskId) : false,
  );
  const addActivity = useActivityStore((s) => s.addEntry);
  const setActivityStreaming = useActivityStore((s) => s.setStreaming);

  const [initialized, setInitialized] = useState(false);
  const [mobileTab, setMobileTab] = useState<'tasks' | 'activity' | 'results'>('tasks');

  // Artifact state
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>();
  const [allArtifacts, setAllArtifacts] = useState<DetectedArtifact[]>([]);

  const sessionKey = project?.sessionKey ?? '';
  const { messages, streaming, sendMessage, abortGeneration } = useChat(projectId, sessionKey);

  // Set active project
  useEffect(() => {
    setActiveProject(projectId);
  }, [projectId, setActiveProject]);

  // Load tasks + persisted messages on mount
  useEffect(() => {
    if (projectId && !initialized) {
      loadTasks(projectId);
      loadPersistedMessages(projectId)
        .then((msgs) => {
          if (msgs.length > 0) {
            setMessages(projectId, msgs);
          }
          setInitialized(true);
        })
        .catch(() => setInitialized(true));
    }
  }, [projectId, initialized, setMessages, loadTasks]);

  // Detect artifacts from messages
  const detectedArtifacts = useMemo(() => {
    const artifacts: DetectedArtifact[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        artifacts.push(...detectArtifacts(msg.content));
      }
    }
    if (streaming?.content) {
      artifacts.push(...detectArtifacts(streaming.content));
    }
    return artifacts;
  }, [messages, streaming?.content]);

  useEffect(() => {
    setAllArtifacts(detectedArtifacts);
  }, [detectedArtifacts]);

  // Persist artifacts from finalized messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isStreaming) {
        const artifacts = detectArtifacts(lastMsg.content);
        if (artifacts.length > 0) {
          persistArtifacts(projectId, lastMsg.id, artifacts).catch(console.error);
        }
      }
    }
  }, [messages.length, messages, projectId]);

  // Keep a ref to tasks so the event wiring effect doesn't loop
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Wire up activity mapping from Gateway events for the active task
  useEffect(() => {
    if (!selectedTaskId) return;

    const activeTask = tasksRef.current.find((t) => t.id === selectedTaskId);
    if (!activeTask?.runId) return;

    const client = getGatewayClient();
    const prevEvents = client['events'] as {
      onChatEvent?: (p: ChatEventPayload) => void;
      onAgentEvent?: (p: AgentEventPayload) => void;
    };

    // Wrap chat event handler to also map to activities
    const origChat = prevEvents.onChatEvent;
    const wrappedChat = (payload: ChatEventPayload) => {
      origChat?.(payload);

      // Only map events for the active task's run
      if (payload.runId === activeTask.runId) {
        const entry = mapChatEventToActivity(payload, selectedTaskId);
        if (entry) {
          addActivity(selectedTaskId, entry);
        }

        // Update task status based on event state
        if (payload.state === 'delta' && activeTask.status !== 'active') {
          updateTask(selectedTaskId, {
            status: 'active',
            startedAt: new Date().toISOString(),
          });
          setActivityStreaming(selectedTaskId, true);
        }
        if (payload.state === 'final') {
          updateTask(selectedTaskId, {
            status: 'done',
            completedAt: new Date().toISOString(),
          });
          setActivityStreaming(selectedTaskId, false);
        }
        if (payload.state === 'error' || payload.state === 'aborted') {
          updateTask(selectedTaskId, {
            status: 'failed',
            errorMessage: payload.errorMessage ?? 'Aborted',
            completedAt: new Date().toISOString(),
          });
          setActivityStreaming(selectedTaskId, false);
        }
      }
    };

    const origAgent = prevEvents.onAgentEvent;
    const wrappedAgent = (payload: AgentEventPayload) => {
      origAgent?.(payload);

      if (payload.runId === activeTask.runId) {
        const entry = mapAgentEventToActivity(payload, selectedTaskId);
        if (entry) {
          addActivity(selectedTaskId, entry);
        }
      }
    };

    client.setEvents({
      ...client['events'],
      onChatEvent: wrappedChat,
      onAgentEvent: wrappedAgent,
    });

    // Restore original on cleanup
    return () => {
      client.setEvents({
        ...client['events'],
        onChatEvent: origChat,
        onAgentEvent: origAgent,
      });
    };
  }, [selectedTaskId, addActivity, updateTask, setActivityStreaming]);

  // Handle creating a task: create in DB, then send to Gateway
  const handleCreateTask = useCallback(
    async (title: string, description?: string) => {
      try {
        const task = await createTask(projectId, title, description);
        selectTask(task.id);

        // Send task to Gateway as a chat message
        if (isConnected) {
          const message = description
            ? `Task: ${title}\n\n${description}`
            : `Task: ${title}`;

          try {
            const result = await sendMessage(message) as { runId?: string } | undefined;
            if (result?.runId) {
              updateTask(task.id, {
                status: 'active',
                runId: result.runId,
                startedAt: new Date().toISOString(),
              });
              setActivityStreaming(task.id, true);

              // Add initial activity entry
              addActivity(task.id, {
                id: `activity-${task.id}-start`,
                taskId: task.id,
                timestamp: new Date().toISOString(),
                type: 'message',
                title: `Task sent: ${title}`,
              });
            }
          } catch (err) {
            updateTask(task.id, {
              status: 'failed',
              errorMessage: err instanceof Error ? err.message : 'Failed to send',
            });
            toast.error('Failed to send task to agent', {
              description: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        } else {
          toast.warning('Task created but agent is not connected', {
            description: 'Connect your Gateway to execute tasks',
          });
        }
      } catch (err) {
        toast.error('Failed to create task', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [projectId, createTask, selectTask, isConnected, sendMessage, updateTask, addActivity, setActivityStreaming],
  );

  // Handle cancelling a task
  const handleCancelTask = useCallback(
    async (taskId: string) => {
      try {
        // Abort the Gateway agent if connected and task has a runId
        const task = tasks.find((t) => t.id === taskId);
        if (task?.runId && isConnected) {
          try { await abortGeneration(); } catch { /* best effort */ }
        }
        await cancelTask(taskId);
        setActivityStreaming(taskId, false);
        addActivity(taskId, {
          id: `activity-${taskId}-cancelled`,
          taskId,
          timestamp: new Date().toISOString(),
          type: 'error',
          title: 'Task cancelled by user',
        });
        toast.info('Task cancelled');
      } catch (err) {
        toast.error('Failed to cancel task', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [tasks, isConnected, abortGeneration, cancelTask, setActivityStreaming, addActivity],
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // ── Not Found ──
  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <FolderOpen className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Project not found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This project may have been deleted or the link is incorrect.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // ── Mobile Layout ──
  const mobileLayout = (
    <div className="flex h-full flex-col md:hidden">
      {/* Project header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-lg">{project.icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate">{project.name}</h2>
        </div>
      </div>

      {/* Mobile tabs */}
      <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as typeof mobileTab)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full rounded-none border-b" variant="line">
          <TabsTrigger value="tasks" className="flex-1">Tasks</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
          <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="flex-1 overflow-hidden m-0">
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={(id) => {
              selectTask(id);
              setMobileTab('activity');
            }}
            onCreateTask={handleCreateTask}
            onCancelTask={handleCancelTask}
            isConnected={isConnected}
          />
        </TabsContent>

        <TabsContent value="activity" className="flex-1 overflow-hidden m-0">
          <ActivityFeed
            entries={activityEntries}
            isStreaming={isStreaming}
            taskTitle={selectedTask?.title}
          />
        </TabsContent>

        <TabsContent value="results" className="flex-1 overflow-hidden m-0">
          {allArtifacts.length > 0 ? (
            <ArtifactPanel
              artifacts={allArtifacts}
              selectedId={selectedArtifactId}
              onSelect={setSelectedArtifactId}
              onClose={() => {}}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No results yet
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // ── Desktop Layout (three-column Agent Dashboard) ──
  const desktopLayout = (
    <div className="hidden md:flex h-full flex-col">
      {/* Project header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-lg">{project.icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate">{project.name}</h2>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate">
              {project.description}
            </p>
          )}
        </div>
        {!isConnected && (
          <Link href="/connect">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              Connect Agent
            </Button>
          </Link>
        )}
      </div>

      {/* Three-column layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left: Task list */}
        <ResizablePanel defaultSize={25} minSize={18} maxSize={35}>
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={selectTask}
            onCreateTask={handleCreateTask}
            onCancelTask={handleCancelTask}
            isConnected={isConnected}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Activity + Results split */}
        <ResizablePanel defaultSize={75} minSize={40}>
          <ResizablePanelGroup direction="vertical">
            {/* Activity Feed */}
            <ResizablePanel defaultSize={allArtifacts.length > 0 ? 55 : 100} minSize={30}>
              <ActivityFeed
                entries={activityEntries}
                isStreaming={isStreaming}
                taskTitle={selectedTask?.title}
              />
            </ResizablePanel>

            {/* Results/Artifacts (only show if there are artifacts) */}
            {allArtifacts.length > 0 && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={45} minSize={20}>
                  <ArtifactPanel
                    artifacts={allArtifacts}
                    selectedId={selectedArtifactId}
                    onSelect={setSelectedArtifactId}
                    onClose={() => {}}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );

  return (
    <>
      {mobileLayout}
      {desktopLayout}
    </>
  );
}
