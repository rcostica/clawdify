'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  rectIntersection,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, ArrowRight, Trash2, Calendar, Clock, GripVertical, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export interface KanbanTask {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: 'backlog' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date | string | null;
}

const COLUMNS: { key: KanbanTask['status']; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'border-t-slate-400' },
  { key: 'in-progress', label: 'In Progress', color: 'border-t-blue-500' },
  { key: 'review', label: 'Review', color: 'border-t-yellow-500' },
  { key: 'done', label: 'Done', color: 'border-t-green-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function SortableTaskCard({
  task,
  onDelete,
  onMove,
  onTaskClick,
  showDueDate,
}: {
  task: KanbanTask;
  onDelete: (id: string) => void;
  onMove: (id: string, status: KanbanTask['status']) => void;
  onTaskClick?: (task: KanbanTask, e: React.MouseEvent) => void;
  showDueDate?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const nextStatus = getNextStatus(task.status);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`shadow-sm cursor-pointer hover:bg-muted/50 transition-colors ${isDragging ? 'ring-2 ring-primary shadow-lg' : ''}`}
      onClick={(e) => onTaskClick?.(task, e)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <button
              className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 p-1 -m-1"
              style={{ touchAction: 'none' }}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium flex-1">{task.title}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {confirmDelete ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); onDelete(task.id); setConfirmDelete(false); }}
                  title="Confirm delete"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                  title="Cancel"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                {nextStatus && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); onMove(task.id, nextStatus); }}
                    title={`Move to ${nextStatus}`}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-5">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap ml-5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority}
          </span>
          {showDueDate && task.dueDate && (() => {
            const { text, isOverdue, isSoon } = formatDueDate(task.dueDate);
            return (
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                isOverdue
                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  : isSoon
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {isOverdue ? <Clock className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                {text}
              </span>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({
  columnKey,
  children,
}: {
  columnKey: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  return (
    <div ref={setNodeRef} className={`flex-1 min-h-[100px] overflow-hidden ${isOver ? 'bg-accent/30' : ''} transition-colors rounded-b-lg`}>
      {children}
    </div>
  );
}

function TaskOverlayCard({ task }: { task: KanbanTask }) {
  return (
    <Card className="shadow-xl ring-2 ring-primary w-64 sm:w-72 rotate-2">
      <CardContent className="p-3">
        <p className="text-sm font-medium">{task.title}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded mt-2 inline-block ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
      </CardContent>
    </Card>
  );
}

function getNextStatus(status: KanbanTask['status']): KanbanTask['status'] | null {
  const idx = COLUMNS.findIndex((c) => c.key === status);
  return idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
}

function formatDueDate(date: Date | string | null | undefined): { text: string; isOverdue: boolean; isSoon: boolean } {
  if (!date) return { text: '', isOverdue: false, isSoon: false };
  const dueDate = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.ceil((dueDateDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;
  const isSoon = diffDays >= 0 && diffDays <= 2;
  let text: string;
  if (diffDays === 0) text = 'Today';
  else if (diffDays === 1) text = 'Tomorrow';
  else if (diffDays === -1) text = 'Yesterday';
  else if (diffDays < -1) text = `${Math.abs(diffDays)}d overdue`;
  else if (diffDays <= 7) text = `${diffDays}d`;
  else text = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { text, isOverdue, isSoon };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface KanbanBoardProps {
  tasks: KanbanTask[];
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  onTaskClick?: (task: any, e: React.MouseEvent) => void;
  addingToColumn: KanbanTask['status'] | null;
  setAddingToColumn: (col: KanbanTask['status'] | null) => void;
  newTaskTitle: string;
  setNewTaskTitle: (v: string) => void;
  newTaskDueDate?: string;
  setNewTaskDueDate?: (v: string) => void;
  onAddTask: (status: KanbanTask['status']) => void;
  onDeleteTask: (id: string) => void;
  showDueDate?: boolean;
  filterFn?: (tasks: KanbanTask[]) => KanbanTask[];
  renderColumnCount?: (columnKey: KanbanTask['status'], filtered: number, total: number) => React.ReactNode;
  searchQuery?: string;
}

export function KanbanBoard({
  tasks,
  setTasks,
  onTaskClick,
  addingToColumn,
  setAddingToColumn,
  newTaskTitle,
  setNewTaskTitle,
  newTaskDueDate,
  setNewTaskDueDate,
  onAddTask,
  onDeleteTask,
  showDueDate = false,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveTask = useCallback(async (taskId: string, newStatus: KanbanTask['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const label = COLUMNS.find(c => c.key === newStatus)?.label || newStatus;
      toast.success(`Moved to ${label}`);
    } catch {
      toast.error('Failed to move task');
    }
  }, [setTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping over a column
    const overColumn = COLUMNS.find(c => c.key === overId);
    if (overColumn) {
      setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overColumn.key } : t));
      return;
    }

    // Dropping over another task
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
      const activeTask = tasks.find(t => t.id === activeId);
      if (activeTask && activeTask.status !== overTask.status) {
        setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overTask.status } : t));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active } = event;
    setActiveTask(null);

    const task = tasks.find(t => t.id === active.id);
    if (!task) return;

    // Persist the status change
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: task.status }),
      });
    } catch {
      toast.error('Failed to update task');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        // First check if pointer is within a droppable (works for empty columns)
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) return pointerCollisions;
        // Fallback to closestCorners
        return closestCorners(args);
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full max-h-[calc(100vh-16rem)] min-w-max">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.key);

          return (
            <div key={column.key} className="w-64 sm:w-72 flex flex-col h-full overflow-hidden">
              <div className={`rounded-t-lg border-t-4 ${column.color} bg-muted/50 px-3 py-2 flex items-center justify-between`}>
                <h2 className="font-medium text-sm">{column.label}</h2>
                <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                  {columnTasks.length}
                </span>
              </div>

              <DroppableColumn columnKey={column.key}>
                <ScrollArea className="h-full border border-t-0 rounded-b-lg">
                  <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="p-2 space-y-2">
                      {columnTasks.map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          onDelete={onDeleteTask}
                          onMove={moveTask}
                          onTaskClick={onTaskClick}
                          showDueDate={showDueDate}
                        />
                      ))}

                      {addingToColumn === column.key ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="KanbanTask title..."
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) onAddTask(column.key);
                              if (e.key === 'Escape') {
                                setAddingToColumn(null);
                                setNewTaskTitle('');
                                setNewTaskDueDate?.('');
                              }
                            }}
                            autoFocus
                            className="text-sm"
                          />
                          {setNewTaskDueDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <input
                                type="date"
                                value={newTaskDueDate || ''}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                className="flex-1 text-xs border rounded px-2 py-1 bg-background"
                              />
                            </div>
                          )}
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => onAddTask(column.key)} className="text-xs">Add</Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setAddingToColumn(null);
                              setNewTaskTitle('');
                              setNewTaskDueDate?.('');
                            }} className="text-xs">Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-muted-foreground text-xs"
                          onClick={() => setAddingToColumn(column.key)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add task
                        </Button>
                      )}
                    </div>
                  </SortableContext>
                </ScrollArea>
              </DroppableColumn>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? <TaskOverlayCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
