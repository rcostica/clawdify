'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, FileText, MessageSquare, X, Loader2,
  LayoutDashboard, FolderKanban, Files, Settings, FolderOpen,
  ListTodo, Plus, Command
} from 'lucide-react';

interface FileResult {
  type: 'file';
  name: string;
  path: string;
  snippet: string;
  line?: number;
}

interface MessageResult {
  type: 'message';
  id: string;
  threadId: string;
  projectId?: string;
  projectName?: string;
  role: string;
  snippet: string;
  createdAt: string;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<FileResult[]>([]);
  const [messages, setMessages] = useState<MessageResult[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Load projects and tasks on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Prefetch data
      fetch('/api/projects').then(r => r.json()).then(d => setProjects(d.projects || [])).catch(() => {});
      fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks || [])).catch(() => {});
    } else {
      setQuery('');
      setFiles([]);
      setMessages([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setFiles([]);
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      setFiles(data.files || []);
      setMessages(data.messages || []);
      setSelectedIndex(0);
    } catch {
      setFiles([]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Build navigation commands
  const navCommands: CommandItem[] = [
    { id: 'nav-dashboard', label: 'Dashboard', description: 'Go to dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => router.push('/'), category: 'Navigation', keywords: 'home overview' },
    { id: 'nav-kanban', label: 'Kanban Board', description: 'View task board', icon: <FolderKanban className="h-4 w-4" />, action: () => router.push('/kanban'), category: 'Navigation', keywords: 'tasks board' },
    { id: 'nav-files', label: 'Files', description: 'Browse workspace files', icon: <Files className="h-4 w-4" />, action: () => router.push('/files'), category: 'Navigation', keywords: 'workspace documents' },
    { id: 'nav-settings', label: 'Settings', description: 'Configure Clawdify', icon: <Settings className="h-4 w-4" />, action: () => router.push('/settings'), category: 'Navigation', keywords: 'config preferences' },
    { id: 'nav-new-project', label: 'New Project', description: 'Create a new project', icon: <Plus className="h-4 w-4" />, action: () => router.push('/project/new'), category: 'Actions', keywords: 'create add' },
  ];

  // Build project commands
  const projectCommands: CommandItem[] = projects.map(p => ({
    id: `project-${p.id}`,
    label: `${p.icon || '📁'} ${p.name}`,
    description: p.description || 'Project',
    icon: <FolderOpen className="h-4 w-4" />,
    action: () => router.push(`/project/${p.id}`),
    category: 'Projects',
    keywords: p.name,
  }));

  // Build task commands
  const taskCommands: CommandItem[] = tasks.slice(0, 20).map((t: any) => ({
    id: `task-${t.id}`,
    label: t.title,
    description: `${t.status} ${t.projectName ? '· ' + t.projectName : ''}`,
    icon: <ListTodo className="h-4 w-4" />,
    action: () => { if (t.projectId) router.push(`/project/${t.projectId}`); },
    category: 'Tasks',
    keywords: `${t.title} ${t.status}`,
  }));

  const allCommands = [...navCommands, ...projectCommands, ...taskCommands];

  // Filter commands by query
  const filteredCommands = query.length > 0
    ? allCommands.filter(cmd => fuzzyMatch(query, `${cmd.label} ${cmd.description || ''} ${cmd.keywords || ''}`))
    : navCommands; // Show nav commands when empty

  // Build combined results
  const allResults: { type: string; item: any; index: number }[] = [];
  
  // Commands first
  const commandResults = filteredCommands.map((cmd, i) => ({ type: 'command' as const, item: cmd, index: i }));
  allResults.push(...commandResults);

  // Then file results
  const fileResults = files.map((f, i) => ({ type: 'file' as const, item: f, index: commandResults.length + i }));
  allResults.push(...fileResults);

  // Then message results
  const messageResults = messages.map((m, i) => ({ type: 'message' as const, item: m, index: commandResults.length + fileResults.length + i }));
  allResults.push(...messageResults);

  const handleSelect = (index: number) => {
    const result = allResults[index];
    if (!result) return;
    setOpen(false);
    if (result.type === 'command') {
      (result.item as CommandItem).action();
    } else if (result.type === 'file') {
      router.push('/files');
    } else if (result.type === 'message' && result.item.projectId) {
      router.push(`/project/${result.item.projectId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => {
        const next = Math.min(i + 1, allResults.length - 1);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  // Group commands by category for display
  const categories = new Map<string, typeof allResults>();
  for (const r of allResults) {
    const cat = r.type === 'command' ? (r.item as CommandItem).category 
      : r.type === 'file' ? 'Files' 
      : 'Messages';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(r);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-popover border border-border/50 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Command className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {allResults.length === 0 && query.length >= 2 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(categories.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover/95 backdrop-blur-sm">
                  {category}
                </div>
                {items.map((result) => {
                  const globalIdx = allResults.indexOf(result);
                  const isSelected = selectedIndex === globalIdx;
                  
                  if (result.type === 'command') {
                    const cmd = result.item as CommandItem;
                    return (
                      <button
                        key={cmd.id}
                        ref={isSelected ? selectedRef : undefined}
                        className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleSelect(globalIdx)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <div className="text-muted-foreground shrink-0">{cmd.icon}</div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">{cmd.label}</span>
                          {cmd.description && (
                            <span className="text-xs text-muted-foreground ml-2">{cmd.description}</span>
                          )}
                        </div>
                        {isSelected && (
                          <kbd className="text-[10px] text-muted-foreground">↵</kbd>
                        )}
                      </button>
                    );
                  }
                  
                  if (result.type === 'file') {
                    const file = result.item as FileResult;
                    return (
                      <button
                        key={`file-${file.path}`}
                        ref={isSelected ? selectedRef : undefined}
                        className={`w-full text-left px-4 py-2 flex items-start gap-3 transition-colors ${
                          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleSelect(globalIdx)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{file.snippet}</div>
                        </div>
                      </button>
                    );
                  }

                  const msg = result.item as MessageResult;
                  return (
                    <button
                      key={`msg-${msg.id}`}
                      ref={isSelected ? selectedRef : undefined}
                      className={`w-full text-left px-4 py-2 flex items-start gap-3 transition-colors ${
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleSelect(globalIdx)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                    >
                      <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">
                          {msg.projectName && <span className="font-medium">{msg.projectName}</span>}
                          {' · '}{msg.role}
                        </div>
                        <div className="text-sm truncate">{msg.snippet}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">↵</kbd> open</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
