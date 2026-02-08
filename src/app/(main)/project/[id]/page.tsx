'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import { useProjectsStore } from '@/lib/stores/projects';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, Square, Loader2, Paperclip, X, FileText, FileCode, File as FileIcon } from 'lucide-react';
import { useChatAttachmentsStore } from '@/lib/stores/chat-attachments';
import type { Project } from '@/lib/db/schema';

interface AttachedFile {
  path: string;    // relative to workspace
  name: string;
  size?: number;
  extension?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachedFiles?: AttachedFile[];
  createdAt: Date;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { selectProject } = useProjectsStore();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const pendingAttachments = useChatAttachmentsStore((s) => s.pending);
  const clearPending = useChatAttachmentsStore((s) => s.clearPending);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [pickerFiles, setPickerFiles] = useState<any[]>([]);
  const [pickerPath, setPickerPath] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    selectProject(id);
    
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error('Project not found');
        const data = await res.json();
        setProject(data.project);
      } catch (err) {
        console.error('Failed to fetch project:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProject();

    // Load chat history
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/chat?projectId=${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length) {
            setMessages(data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: new Date(m.createdAt),
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    }
    fetchHistory();

    return () => selectProject(null);
  }, [id, selectProject]);

  // Pick up pending attachments from file browser "Send to Chat"
  useEffect(() => {
    if (pendingAttachments.length > 0) {
      setAttachedFiles(prev => {
        const merged = [...prev];
        for (const pa of pendingAttachments) {
          if (!merged.some(f => f.path === pa.path)) {
            merged.push(pa);
          }
        }
        return merged;
      });
      clearPending();
      inputRef.current?.focus();
    }
  }, [pendingAttachments, clearPending]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // File picker: browse workspace files
  const loadPickerDir = useCallback(async (dirPath: string) => {
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      setPickerFiles(data.entries || []);
      setPickerPath(dirPath);
    } catch {
      setPickerFiles([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const openFilePicker = useCallback(() => {
    setShowFilePicker(true);
    // Start from project workspace if available
    const startPath = project?.workspacePath || '';
    loadPickerDir(startPath);
  }, [project, loadPickerDir]);

  const addFile = useCallback((file: AttachedFile) => {
    setAttachedFiles(prev => {
      if (prev.some(f => f.path === file.path)) return prev; // no dupes
      return [...prev, file];
    });
  }, []);

  const removeFile = useCallback((filePath: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== filePath));
  }, []);

  // Drag and drop handlers (for workspace file paths from the file browser)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Check for workspace file path (from our file browser)
    const filePath = e.dataTransfer.getData('text/x-workspace-path');
    const fileName = e.dataTransfer.getData('text/x-workspace-name');
    if (filePath) {
      addFile({ path: filePath, name: fileName || filePath.split('/').pop() || filePath });
      return;
    }

    // Check for plain text that looks like a path
    const text = e.dataTransfer.getData('text/plain');
    if (text && !text.includes('\n') && (text.includes('/') || text.includes('.'))) {
      const name = text.split('/').pop() || text;
      addFile({ path: text, name });
    }
  }, [addFile]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;

    const currentFiles = [...attachedFiles];
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      attachedFiles: currentFiles.length > 0 ? currentFiles : undefined,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input.trim();
    setInput('');
    setAttachedFiles([]);
    setSending(true);
    setStreamingContent('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          projectId: id,
          attachedFiles: currentFiles.map(f => f.path),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Error ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      // Read the SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulated += delta;
                setStreamingContent(accumulated);
              }
            } catch {
              // Not valid JSON, skip
            }
          }
        }
      }

      // Streaming complete — add as full message
      if (accumulated) {
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: accumulated,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled
        if (streamingContent) {
          setMessages((prev) => [...prev, {
            id: `msg-${Date.now()}-cancelled`,
            role: 'assistant',
            content: streamingContent + '\n\n*(cancelled)*',
            createdAt: new Date(),
          }]);
        }
      } else {
        console.error('Chat error:', error);
        setMessages((prev) => [...prev, {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: `⚠️ Error: ${(error as Error).message}`,
          createdAt: new Date(),
        }]);
      }
    } finally {
      setSending(false);
      setStreamingContent('');
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, sending, id, streamingContent]);

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !streamingContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-medium mb-1">Start a conversation</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Chat with your agent about <strong>{project.name}</strong>. 
              Your conversation will include project context automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.attachedFiles && message.attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {message.attachedFiles.map((f) => (
                        <span
                          key={f.path}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-black/10 dark:bg-white/10"
                          title={f.path}
                        >
                          <FileText className="h-3 w-3" />
                          {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            
            {/* Streaming response */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-2.5 bg-muted">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{streamingContent}</p>
                  <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
                </div>
              </div>
            )}
            
            {/* Loading indicator (before stream starts) */}
            {sending && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowFilePicker(false)}>
          <div className="bg-background border rounded-lg shadow-lg w-[480px] max-h-[400px] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" />
                Attach Files
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowFilePicker(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-4 py-2 text-xs text-muted-foreground border-b flex items-center gap-1">
              <button className="hover:underline" onClick={() => loadPickerDir('')}>workspace</button>
              {pickerPath.split('/').filter(Boolean).map((seg, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <span>/</span>
                  <button className="hover:underline" onClick={() => loadPickerDir(arr.slice(0, i + 1).join('/'))}>{seg}</button>
                </span>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {pickerLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="divide-y">
                  {pickerPath && (
                    <button className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-sm" onClick={() => loadPickerDir(pickerPath.split('/').slice(0, -1).join('/'))}>
                      <span className="text-muted-foreground">..</span>
                    </button>
                  )}
                  {pickerFiles.map((entry: any) => (
                    <button
                      key={entry.path}
                      className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                      onClick={() => {
                        if (entry.type === 'directory') {
                          loadPickerDir(entry.path);
                        } else {
                          addFile({ path: entry.path, name: entry.name, size: entry.size, extension: entry.extension });
                          setShowFilePicker(false);
                        }
                      }}
                    >
                      {entry.type === 'directory' ? (
                        <span className="text-blue-500">📁</span>
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{entry.name}</span>
                      {entry.size != null && (
                        <span className="text-xs text-muted-foreground">{entry.size < 1024 ? `${entry.size}B` : `${(entry.size / 1024).toFixed(1)}KB`}</span>
                      )}
                      {entry.type === 'file' && attachedFiles.some(f => f.path === entry.path) && (
                        <span className="text-xs text-green-500">✓</span>
                      )}
                    </button>
                  ))}
                  {pickerFiles.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">Empty directory</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div
        className={`border-t p-3 sm:p-4 transition-colors ${isDragOver ? 'bg-primary/5 border-primary' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto">
          {/* Attached files bar */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map((f) => (
                <span
                  key={f.path}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted border group"
                  title={f.path}
                >
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-[150px] truncate">{f.name}</span>
                  <button onClick={() => removeFile(f.path)} className="ml-0.5 opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={openFilePicker}
              disabled={sending}
              title="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isDragOver ? 'Drop files here...' : `Message ${project.name}...`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending}
              rows={1}
              className="flex-1 min-h-[40px] max-h-[200px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
            {sending ? (
              <Button onClick={handleStop} variant="destructive" size="icon" className="shrink-0">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isDragOver && (
            <p className="text-xs text-primary mt-1 text-center">Drop to attach file</p>
          )}
        </div>
      </div>
    </div>
  );
}
