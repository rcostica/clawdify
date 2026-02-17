'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Folder, FileText, FileCode, FileImage, File as FileIcon,
  ChevronRight, ArrowLeft, Download, FolderPlus,
  Loader2, Plus, MessageSquare, Upload, Pencil
} from 'lucide-react';
import { useChatAttachmentsStore } from '@/lib/stores/chat-attachments';
import { toast } from 'sonner';
import type { Project } from '@/lib/db/schema';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  extension?: string;
}

interface FileContent {
  type: 'file';
  path: string;
  content?: string;
  binary?: boolean;
  size: number;
  extension?: string;
  modifiedAt?: string;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(entry: FileEntry) {
  if (entry.type === 'directory') return <Folder className="h-4 w-4 text-blue-500" />;
  const ext = entry.extension?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'json', 'yaml', 'yml', 'toml'];
  if (imageExts.includes(ext || '')) return <FileImage className="h-4 w-4 text-green-500" />;
  if (codeExts.includes(ext || '')) return <FileCode className="h-4 w-4 text-yellow-500" />;
  if (ext === 'md') return <FileText className="h-4 w-4 text-purple-500" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

export function FilesPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const addAttachment = useChatAttachmentsStore((s) => s.addAttachment);
  const [project, setProject] = useState<Project | null>(null);
  const [currentSubPath, setCurrentSubPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const toggleFileSelection = useCallback((entry: FileEntry) => {
    if (entry.type === 'directory') return;
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(entry.path)) next.delete(entry.path);
      else next.add(entry.path);
      return next;
    });
  }, []);

  const sendSelectedToChat = useCallback(() => {
    const selected = entries.filter(e => selectedFiles.has(e.path));
    for (const entry of selected) {
      addAttachment({
        path: entry.path,
        name: entry.name,
        size: entry.size,
        extension: entry.extension,
      });
    }
    setSelectedFiles(new Set());
  }, [entries, selectedFiles, addAttachment]);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error('Project not found');
        const data = await res.json();
        setProject(data.project);
      } catch (err) {
        console.error('Failed to fetch project:', err);
      }
    }
    fetchProject();
  }, [projectId]);

  const basePath = project?.workspacePath || '';

  const fetchDirectory = useCallback(async (subPath: string) => {
    if (!basePath) return;
    setLoading(true);
    try {
      const fullPath = subPath ? `${basePath}/${subPath}` : basePath;
      const res = await fetch(`/api/files?path=${encodeURIComponent(fullPath)}`);
      if (!res.ok) throw new Error('Failed to load directory');
      const data = await res.json();
      setEntries(data.entries || []);
      setCurrentSubPath(subPath);
      setSelectedFile(null);
      setSelectedFiles(new Set());
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    if (basePath) fetchDirectory('');
  }, [basePath, fetchDirectory]);

  const uploadFile = useCallback(async (file: File) => {
    if (!basePath) return;
    const formData = new FormData();
    formData.append('file', file);
    // Upload to current directory
    const directory = currentSubPath ? `${basePath}/${currentSubPath}` : basePath;
    formData.append('directory', directory);
    
    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      toast.success(`Uploaded ${data.name}`);
      fetchDirectory(currentSubPath);
    } catch (err) {
      console.error('File upload failed:', err);
      toast.error('Upload failed');
    }
  }, [basePath, currentSubPath, fetchDirectory]);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    } finally {
      setUploading(false);
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const fetchFile = useCallback(async (filePath: string) => {
    setFileLoading(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to load file');
      const data = await res.json();
      setSelectedFile(data);
    } catch (err) {
      console.error('Failed to load file:', err);
    } finally {
      setFileLoading(false);
    }
  }, []);

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      const relPath = entry.path.startsWith(basePath + '/')
        ? entry.path.slice(basePath.length + 1)
        : entry.path.replace(basePath, '').replace(/^\//, '');
      fetchDirectory(relPath);
    } else {
      fetchFile(entry.path);
    }
  };

  const goUp = () => {
    const parts = currentSubPath.split('/').filter(Boolean);
    parts.pop();
    fetchDirectory(parts.join('/'));
  };

  const handleCreate = async () => {
    if (!newName.trim() || !basePath) return;
    const fullPath = currentSubPath
      ? `${basePath}/${currentSubPath}/${newName.trim()}`
      : `${basePath}/${newName.trim()}`;
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: creating === 'folder' ? 'create-directory' : 'create-file',
          filePath: fullPath,
          content: creating === 'file' ? '' : undefined,
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      toast.success(`${creating === 'folder' ? 'Folder' : 'File'} created`);
      fetchDirectory(currentSubPath);
    } catch {
      toast.error(`Failed to create ${creating}`);
    }
    setCreating(null);
    setNewName('');
  };

  const startRename = (entry: FileEntry) => {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
  };

  const handleRename = async () => {
    if (!renamingPath || !renameValue.trim() || !basePath) return;
    const oldName = renamingPath.split('/').pop();
    if (renameValue.trim() === oldName) {
      setRenamingPath(null);
      setRenameValue('');
      return;
    }
    const parentDir = renamingPath.substring(0, renamingPath.lastIndexOf('/'));
    const destination = parentDir ? `${parentDir}/${renameValue.trim()}` : renameValue.trim();
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          filePath: renamingPath,
          destination,
        }),
      });
      if (!res.ok) throw new Error('Rename failed');
      toast.success(`Renamed to ${renameValue.trim()}`);
      fetchDirectory(currentSubPath);
    } catch {
      toast.error('Failed to rename');
    }
    setRenamingPath(null);
    setRenameValue('');
  };

  const breadcrumbs = currentSubPath ? currentSubPath.split('/').filter(Boolean) : [];

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* If a file is selected, show it; otherwise show directory listing */}
      {selectedFile ? (
        <div className="flex flex-col h-full">
          <div className="border-b px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedFile(null)}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-xs font-medium truncate">{selectedFile.path.split('/').pop()}</h2>
                <div className="text-[10px] text-muted-foreground">
                  {formatSize(selectedFile.size)}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                addAttachment({
                  path: selectedFile.path,
                  name: selectedFile.path.split('/').pop() || 'file',
                  size: selectedFile.size,
                  extension: selectedFile.extension,
                });
              }}>
                <MessageSquare className="h-3 w-3 mr-1" />
                Chat
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {fileLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : selectedFile.binary ? (
              <div className="flex items-center justify-center p-8 text-center">
                <div>
                  <FileIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Binary file ({formatSize(selectedFile.size)})</p>
                </div>
              </div>
            ) : (
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
                {selectedFile.content}
              </pre>
            )}
          </ScrollArea>
        </div>
      ) : (
        <>
          <div className="border-b px-3 py-2 flex items-center gap-1">
            {currentSubPath && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goUp}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="flex-1 text-xs text-muted-foreground truncate ml-1">
              {project.icon} {project.name}{currentSubPath ? `/${currentSubPath}` : ''}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreating('file')}>
              <Plus className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreating('folder')} title="New folder">
              <FolderPlus className="h-3 w-3" />
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    setUploading(true);
                    Promise.all(Array.from(files).map(uploadFile))
                      .finally(() => setUploading(false));
                  }
                  e.target.value = '';
                }}
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" asChild title="Upload file">
                <span><Upload className="h-3 w-3" /></span>
              </Button>
            </label>
          </div>

          {breadcrumbs.length > 0 && (
            <div className="px-3 py-1 border-b flex flex-wrap items-center gap-0.5 text-[11px]">
              <button onClick={() => fetchDirectory('')} className="text-muted-foreground hover:text-foreground">
                {project.name}
              </button>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                  <button
                    onClick={() => fetchDirectory(breadcrumbs.slice(0, i + 1).join('/'))}
                    className={i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}
                  >
                    {crumb}
                  </button>
                </span>
              ))}
            </div>
          )}

          <ScrollArea 
            className={`flex-1 transition-colors ${isDragOver ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleFileDrop}
          >
            {/* Upload indicator */}
            {uploading && (
              <div className="px-3 py-2 border-b bg-muted/50 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs text-muted-foreground">Uploading...</span>
              </div>
            )}
            
            {/* Drag overlay */}
            {isDragOver && (
              <div className="px-3 py-6 border-b text-center">
                <Upload className="h-6 w-6 text-primary mx-auto mb-1" />
                <p className="text-xs text-primary font-medium">Drop files to upload</p>
              </div>
            )}
            
            {creating && (
              <div className="px-3 py-2 border-b space-y-2">
                <p className="text-xs text-muted-foreground">New {creating}:</p>
                <Input
                  placeholder={creating === 'folder' ? 'folder-name' : 'filename.md'}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(null); setNewName(''); }
                  }}
                  autoFocus
                  className="text-sm h-8"
                />
                <div className="flex gap-1">
                  <Button size="sm" className="text-xs h-7" onClick={handleCreate}>Create</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setCreating(null); setNewName(''); }}>Cancel</Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-1 space-y-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                No files yet.
              </div>
            ) : (
              <div className="py-1">
                {entries.map((entry) => (
                  <div
                    key={entry.path}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-muted transition-colors group/entry"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      startRename(entry);
                    }}
                  >
                    {entry.type === 'file' && (
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(entry.path)}
                        onChange={() => toggleFileSelection(entry)}
                        className="h-3.5 w-3.5 rounded border-muted-foreground/50 cursor-pointer accent-primary"
                      />
                    )}
                    {entry.type === 'directory' && <span className="w-3.5" />}
                    {renamingPath === entry.path ? (
                      <div className="flex-1 flex items-center gap-1 min-w-0">
                        {getFileIcon(entry)}
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename();
                            if (e.key === 'Escape') { setRenamingPath(null); setRenameValue(''); }
                          }}
                          onBlur={handleRename}
                          autoFocus
                          className="h-6 text-xs flex-1"
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEntryClick(entry)}
                          onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(entry); }}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          {getFileIcon(entry)}
                          <span className="flex-1 truncate text-xs">{entry.name}</span>
                          {entry.size !== undefined && (
                            <span className="text-[10px] text-muted-foreground">{formatSize(entry.size)}</span>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(entry); }}
                          className="opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0 p-0.5 hover:bg-muted-foreground/10 rounded"
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedFiles.size > 0 && (
            <div className="border-t px-3 py-2 flex items-center justify-between bg-muted/50">
              <span className="text-xs text-muted-foreground">
                {selectedFiles.size} selected
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setSelectedFiles(new Set())}>
                  Clear
                </Button>
                <Button size="sm" className="text-xs h-6" onClick={sendSelectedToChat}>
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Chat
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
