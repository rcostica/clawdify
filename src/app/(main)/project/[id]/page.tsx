'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import { useProjectsStore } from '@/lib/stores/projects';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, Square, Loader2, Paperclip, X, FileText, FileCode, File as FileIcon, Search, Copy, Check, Reply, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useChatAttachmentsStore } from '@/lib/stores/chat-attachments';
import { useNotificationsStore, getLastSeen, setLastSeen } from '@/lib/stores/notifications';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
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

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  let matchIdx = 0;
  return (
    <>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          regex.lastIndex = 0; // reset after test
          const idx = matchIdx++;
          return (
            <mark
              key={i}
              data-search-match={idx}
              className="search-match bg-yellow-300/70 dark:bg-yellow-500/40 rounded-sm px-0.5"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { selectProject } = useProjectsStore();
  const { markUnread, markRead } = useNotificationsStore();
  const searchParams = useSearchParams();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
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

  // Pre-fill from query param (kanban quick action)
  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt) {
      setInput(prompt);
      // Clean URL without triggering navigation
      window.history.replaceState({}, '', `/project/${id}`);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchParams, id]);

  // Track last seen & show new message toast
  useEffect(() => {
    const lastSeen = getLastSeen(id);
    markRead(id);

    if (messages.length > 0 && lastSeen > 0) {
      const newMsgs = messages.filter(
        (m) => m.role === 'assistant' && new Date(m.createdAt).getTime() > lastSeen
      );
      if (newMsgs.length > 0) {
        toast.info(`${newMsgs.length} new message${newMsgs.length !== 1 ? 's' : ''}`);
      }
    }

    return () => {
      setLastSeen(id);
    };
  }, [id, messages.length, markRead]);

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

  // Cmd+F / Cmd+K to toggle search within chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'k') && !e.shiftKey) {
        if (messages.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (showSearch) {
            setShowSearch(false);
            setSearchQuery('');
            setCurrentMatchIndex(0);
            setTotalMatches(0);
          } else {
            setShowSearch(true);
            setTimeout(() => document.getElementById('chat-search-input')?.focus(), 50);
          }
        }
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        setCurrentMatchIndex(0);
        setTotalMatches(0);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [messages.length, showSearch]);

  // Count matches and scroll to current match
  useEffect(() => {
    if (!searchQuery.trim()) {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }
    // Use requestAnimationFrame to wait for DOM to update with highlights
    requestAnimationFrame(() => {
      const marks = document.querySelectorAll('[data-search-match]');
      setTotalMatches(marks.length);
      if (marks.length > 0) {
        setCurrentMatchIndex(prev => Math.min(prev, marks.length - 1));
      } else {
        setCurrentMatchIndex(0);
      }
    });
  }, [searchQuery, messages]);

  // Scroll to current match
  useEffect(() => {
    if (totalMatches === 0) return;
    requestAnimationFrame(() => {
      const marks = document.querySelectorAll('[data-search-match]');
      marks.forEach((m, i) => {
        (m as HTMLElement).classList.toggle('search-match-current', i === currentMatchIndex);
      });
      if (marks[currentMatchIndex]) {
        marks[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [currentMatchIndex, totalMatches, searchQuery]);

  const goToNextMatch = useCallback(() => {
    setCurrentMatchIndex(prev => (prev + 1) % Math.max(totalMatches, 1));
  }, [totalMatches]);

  const goToPrevMatch = useCallback(() => {
    setCurrentMatchIndex(prev => (prev - 1 + Math.max(totalMatches, 1)) % Math.max(totalMatches, 1));
  }, [totalMatches]);

  // Copy message as markdown
  const copyMessage = useCallback(async (message: Message) => {
    let text = message.content;
    if (message.attachedFiles?.length) {
      const fileList = message.attachedFiles.map(f => `- ${f.name}`).join('\n');
      text = `**Attached files:**\n${fileList}\n\n${text}`;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (e.g. HTTP over Tailscale)
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

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

  // Upload a file (from file input or clipboard paste)
  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('directory', '_uploads');
    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      addFile({ path: data.path, name: data.name, size: data.size });
    } catch (err) {
      console.error('File upload failed:', err);
    }
  }, [addFile]);

  // Handle native file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(uploadFile);
    }
    // Reset so same file can be selected again
    e.target.value = '';
  }, [uploadFile]);

  // Handle paste (for screenshots / images)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Give it a meaningful name
          const ext = file.type.split('/')[1] || 'png';
          const namedFile = new File([file], `screenshot-${Date.now()}.${ext}`, { type: file.type });
          uploadFile(namedFile);
        }
        return;
      }
    }
  }, [uploadFile]);

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
    const replyToId = replyTo?.id;
    const replyToContent = replyTo?.content;
    setInput('');
    setAttachedFiles([]);
    setReplyTo(null);
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
          ...(replyToId ? { replyTo: { id: replyToId, content: replyToContent?.slice(0, 200) } } : {}),
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

        // Browser notification if tab not focused
        if (document.hidden && Notification.permission === 'granted') {
          try {
            new Notification(project?.name || 'Clawdify', {
              body: accumulated.slice(0, 100) + (accumulated.length > 100 ? '...' : ''),
              icon: '/icon-192.png',
            });
          } catch { /* ignore */ }
        }

        // Mark as unread for sidebar indicator (if navigated away)
        if (document.hidden) {
          markUnread(id);
        }
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
      {/* Header with search toggle */}
      {messages.length > 0 && !showSearch && (
        <div className="border-b px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setShowSearch(true); setTimeout(() => document.getElementById('chat-search-input')?.focus(), 50); }}
          >
            <Search className="h-3.5 w-3.5 mr-1" />
            Search
            <kbd className="ml-2 px-1 py-0.5 rounded bg-muted border text-[10px]">⌘F</kbd>
          </Button>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && (
        <div className="border-b px-4 py-2 flex items-center gap-2 bg-muted/30">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            id="chat-search-input"
            type="text"
            placeholder="Find in chat..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatchIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goToPrevMatch() : goToNextMatch(); }
              if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setCurrentMatchIndex(0); setTotalMatches(0); }
            }}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {searchQuery.trim() && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : 'No results'}
            </span>
          )}
          <button onClick={goToPrevMatch} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={totalMatches === 0} title="Previous (Shift+Enter)">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button onClick={goToNextMatch} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={totalMatches === 0} title="Next (Enter)">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); setCurrentMatchIndex(0); setTotalMatches(0); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                className={`flex group ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-lg px-4 py-2.5 ${
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
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {showSearch && searchQuery.trim() ? (
                        <HighlightedText text={message.content} query={searchQuery} />
                      ) : (
                        message.content
                      )}
                    </p>
                    <div className="flex items-center gap-1 mt-2 justify-end">
                      <button
                        onClick={() => copyMessage(message)}
                        className={`p-1 rounded transition-colors ${
                          message.role === 'user'
                            ? 'text-primary-foreground/50 hover:text-primary-foreground'
                            : 'text-muted-foreground/50 hover:text-muted-foreground'
                        }`}
                        title="Copy as markdown"
                      >
                        {copiedId === message.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => { setReplyTo(message); inputRef.current?.focus(); }}
                        className={`p-1 rounded transition-colors ${
                          message.role === 'user'
                            ? 'text-primary-foreground/50 hover:text-primary-foreground'
                            : 'text-muted-foreground/50 hover:text-muted-foreground'
                        }`}
                        title="Reply"
                      >
                        <Reply className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
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
          {/* Reply preview bar */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-md bg-muted/60 border-l-2 border-primary">
              <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-primary">{replyTo.role === 'user' ? 'You' : 'Assistant'}</span>
                <p className="text-xs text-muted-foreground truncate">{replyTo.content.slice(0, 120)}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="shrink-0 p-0.5 hover:bg-muted rounded">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
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
          {/* Hidden file input for native upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="flex gap-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-5 w-10"
                onClick={openFilePicker}
                disabled={sending}
                title="Attach workspace file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-5 w-10"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Upload file from device"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isDragOver ? 'Drop files here...' : `Message ${project.name}...`}
              onPaste={handlePaste}
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
