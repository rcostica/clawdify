'use client';

import { useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Brain, FileText, Calendar, FolderOpen, Pencil, Eye, Save,
  Loader2, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
}

interface FileContent {
  path: string;
  name: string;
  content: string;
  size: number;
  modifiedAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getFileCategory(name: string): 'memory' | 'daily' | 'project' | 'other' {
  if (name === 'MEMORY.md') return 'memory';
  if (/^\d{4}-\d{2}-\d{2}/.test(name)) return 'daily';
  if (/^project-/.test(name)) return 'project';
  return 'other';
}

function getFileIcon(name: string) {
  const category = getFileCategory(name);
  switch (category) {
    case 'memory':
      return <Brain className="h-4 w-4 text-purple-500" />;
    case 'daily':
      return <Calendar className="h-4 w-4 text-blue-500" />;
    case 'project':
      return <FolderOpen className="h-4 w-4 text-amber-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function MemoryPage() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Fetch file list
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/memory');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setFiles(data.files || []);
      return data.files || [];
    } catch {
      toast.error('Failed to load memory files');
      return [];
    } finally {
      setFilesLoading(false);
    }
  }, []);

  // Fetch file content
  const fetchFile = useCallback(async (filePath: string) => {
    setFileLoading(true);
    setMode('view');
    setDirty(false);
    try {
      const res = await fetch(`/api/memory?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to fetch file');
      const data: FileContent = await res.json();
      setFileContent(data);
      setSelectedPath(filePath);
    } catch {
      toast.error('Failed to load file');
    } finally {
      setFileLoading(false);
    }
  }, []);

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedPath) return;
    setSaving(true);
    try {
      const res = await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, content: editContent }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      toast.success('File saved');
      setFileContent(prev => prev ? {
        ...prev,
        content: editContent,
        size: data.size,
        modifiedAt: data.modifiedAt,
      } : null);
      setDirty(false);
      // Update file list metadata
      setFiles(prev => prev.map(f =>
        f.path === selectedPath
          ? { ...f, size: data.size, modifiedAt: data.modifiedAt }
          : f
      ));
    } catch {
      toast.error('Failed to save file');
    } finally {
      setSaving(false);
    }
  }, [selectedPath, editContent]);

  // Initial load + auto-select
  useEffect(() => {
    fetchFiles().then((fileList: MemoryFile[]) => {
      if (!fileList.length) return;

      const today = getTodayString();
      const yesterday = getYesterdayString();

      // Try today's daily file
      const todayFile = fileList.find((f: MemoryFile) =>
        f.path.startsWith('memory/') && f.name.startsWith(today)
      );
      if (todayFile) {
        fetchFile(todayFile.path);
        return;
      }

      // Try yesterday's daily file
      const yesterdayFile = fileList.find((f: MemoryFile) =>
        f.path.startsWith('memory/') && f.name.startsWith(yesterday)
      );
      if (yesterdayFile) {
        fetchFile(yesterdayFile.path);
        return;
      }

      // Fall back to MEMORY.md
      const memoryMd = fileList.find((f: MemoryFile) => f.path === 'MEMORY.md');
      if (memoryMd) {
        fetchFile(memoryMd.path);
        return;
      }

      // Fall back to first file
      if (fileList.length > 0) {
        fetchFile(fileList[0].path);
      }
    });
  }, [fetchFiles, fetchFile]);

  const handleSelectFile = (filePath: string) => {
    if (dirty) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    fetchFile(filePath);
  };

  const enterEditMode = () => {
    setEditContent(fileContent?.content || '');
    setMode('edit');
    setDirty(false);
  };

  const cancelEdit = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setMode('view');
    setDirty(false);
  };

  // Group files for display
  const memoryMd = files.find(f => f.path === 'MEMORY.md');
  const dailyFiles = files.filter(f => f.path !== 'MEMORY.md' && getFileCategory(f.name) === 'daily');
  const projectFiles = files.filter(f => getFileCategory(f.name) === 'project');
  const otherFiles = files.filter(f =>
    f.path !== 'MEMORY.md' &&
    getFileCategory(f.name) !== 'daily' &&
    getFileCategory(f.name) !== 'project'
  );

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Left column — file list */}
      <div className="w-full md:w-[30%] md:min-w-[240px] md:max-w-[360px] border-b md:border-b-0 md:border-r flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold">Memory</h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {files.length} files
          </span>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {filesLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="p-6 text-center">
              <Brain className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No memory files found.</p>
            </div>
          ) : (
            <div className="py-1">
              {/* MEMORY.md pinned at top */}
              {memoryMd && (
                <FileListItem
                  file={memoryMd}
                  isActive={selectedPath === memoryMd.path}
                  isPinned
                  onClick={() => handleSelectFile(memoryMd.path)}
                />
              )}

              {/* Daily files */}
              {dailyFiles.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Daily Logs
                  </span>
                </div>
              )}
              {dailyFiles.map(f => (
                <FileListItem
                  key={f.path}
                  file={f}
                  isActive={selectedPath === f.path}
                  onClick={() => handleSelectFile(f.path)}
                />
              ))}

              {/* Project files */}
              {projectFiles.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Projects
                  </span>
                </div>
              )}
              {projectFiles.map(f => (
                <FileListItem
                  key={f.path}
                  file={f}
                  isActive={selectedPath === f.path}
                  onClick={() => handleSelectFile(f.path)}
                />
              ))}

              {/* Other files */}
              {otherFiles.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Other
                  </span>
                </div>
              )}
              {otherFiles.map(f => (
                <FileListItem
                  key={f.path}
                  file={f}
                  isActive={selectedPath === f.path}
                  onClick={() => handleSelectFile(f.path)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right column — content viewer/editor */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!selectedPath ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Brain className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a memory file to view</p>
            </div>
          </div>
        ) : fileLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : fileContent ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(fileContent.name)}
                <div className="min-w-0">
                  <h3 className="text-sm font-medium truncate">{fileContent.name}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(fileContent.size)} · {formatDate(fileContent.modifiedAt)}
                    {dirty && <span className="text-amber-500 ml-1">· Unsaved changes</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {mode === 'view' ? (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={enterEditMode}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={saveFile}
                      disabled={saving || !dirty}
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMode('view')}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            {mode === 'view' ? (
              <ScrollArea className="flex-1 min-h-0">
                <article className="prose prose-sm dark:prose-invert max-w-none p-6">
                  <ReactMarkdown>{fileContent.content}</ReactMarkdown>
                </article>
              </ScrollArea>
            ) : (
              <textarea
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  setDirty(true);
                }}
                className="flex-1 min-h-0 w-full p-4 text-sm font-mono bg-background resize-none focus:outline-none leading-relaxed"
                spellCheck={false}
                autoFocus
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    saveFile();
                  }
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    const val = e.currentTarget.value;
                    const newVal = val.substring(0, start) + '  ' + val.substring(end);
                    setEditContent(newVal);
                    setDirty(true);
                    setTimeout(() => {
                      e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                    }, 0);
                  }
                }}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function FileListItem({
  file,
  isActive,
  isPinned,
  onClick,
}: {
  file: MemoryFile;
  isActive: boolean;
  isPinned?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        isActive
          ? 'bg-muted font-medium'
          : 'hover:bg-muted/50'
      } ${isPinned ? 'border-b' : ''}`}
    >
      {getFileIcon(file.name)}
      <div className="flex-1 min-w-0">
        <div className={`text-xs truncate ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>
          {file.name}
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span>{formatSize(file.size)}</span>
          <span>·</span>
          <span>{formatDate(file.modifiedAt)}</span>
        </div>
      </div>
    </button>
  );
}
