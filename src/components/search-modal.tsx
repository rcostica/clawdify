'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, MessageSquare, X, Loader2 } from 'lucide-react';

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

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<FileResult[]>([]);
  const [messages, setMessages] = useState<MessageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
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

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
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

  const allResults = [
    ...files.map(f => ({ ...f, _type: 'file' as const })),
    ...messages.map(m => ({ ...m, _type: 'message' as const })),
  ];

  const handleSelect = (index: number) => {
    const item = allResults[index];
    if (!item) return;
    setOpen(false);
    if (item._type === 'file') {
      router.push(`/files`);
    } else if (item._type === 'message' && (item as MessageResult).projectId) {
      router.push(`/project/${(item as MessageResult).projectId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-background border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files and messages..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type to search files and messages...
              <div className="mt-2 text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">⌘K</kbd> to toggle
              </div>
            </div>
          ) : allResults.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <>
              {files.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                    Files
                  </div>
                  {files.map((file, i) => {
                    const globalIdx = i;
                    return (
                      <button
                        key={`file-${i}`}
                        className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-muted transition-colors ${
                          selectedIndex === globalIdx ? 'bg-muted' : ''
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
                  })}
                </div>
              )}

              {messages.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                    Messages
                  </div>
                  {messages.map((msg, i) => {
                    const globalIdx = files.length + i;
                    return (
                      <button
                        key={`msg-${i}`}
                        className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-muted transition-colors ${
                          selectedIndex === globalIdx ? 'bg-muted' : ''
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
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {allResults.length > 0 && (
          <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{allResults.length} result{allResults.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">↵</kbd> open</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
