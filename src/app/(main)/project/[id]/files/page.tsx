'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Folder, FileText, FileCode, FileImage, File as FileIcon,
  ChevronRight, ArrowLeft, Home, Download, Upload, FolderPlus,
  Loader2, Plus, MessageSquare
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useChatAttachmentsStore } from '@/lib/stores/chat-attachments';
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

export default function ProjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
    router.push(`/project/${id}`);
  }, [entries, selectedFiles, addAttachment, router, id]);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error('Project not found');
        const data = await res.json();
        setProject(data.project);
      } catch (err) {
        console.error('Failed to fetch project:', err);
      }
    }
    fetchProject();
  }, [id]);

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
      // Calculate sub-path relative to project base
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
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: creating === 'folder' ? 'create-directory' : 'create-file',
          filePath: fullPath,
          content: creating === 'file' ? '' : undefined,
        }),
      });
      fetchDirectory(currentSubPath);
    } catch (err) {
      console.error('Create failed:', err);
    }
    setCreating(null);
    setNewName('');
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
    <div className="flex flex-col md:flex-row h-full">
      {/* File List */}
      <div className={`w-full md:w-80 border-r flex flex-col ${selectedFile ? 'hidden md:flex' : ''}`}>
        <div className="border-b px-3 py-2 flex items-center gap-1">
          {currentSubPath && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goUp}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="flex-1 text-xs text-muted-foreground truncate ml-1">
            {project.icon} {project.name}{currentSubPath ? `/${currentSubPath}` : ''}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreating('file')}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreating('folder')}>
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {breadcrumbs.length > 0 && (
          <div className="px-3 py-1.5 border-b flex flex-wrap items-center gap-0.5 text-xs">
            <button onClick={() => fetchDirectory('')} className="text-muted-foreground hover:text-foreground">
              {project.name}
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
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

        <ScrollArea className="flex-1">
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
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No files yet. Create one or chat with your agent to generate content!
            </div>
          ) : (
            <div className="py-1">
              {entries.map((entry) => (
                <div
                  key={entry.path}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-muted transition-colors ${
                    selectedFile?.path === entry.path ? 'bg-muted' : ''
                  }`}
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
                  <button
                    onClick={() => handleEntryClick(entry)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    {getFileIcon(entry)}
                    <span className="flex-1 truncate">{entry.name}</span>
                    {entry.size !== undefined && (
                      <span className="text-xs text-muted-foreground">{formatSize(entry.size)}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {selectedFiles.size > 0 && (
          <div className="border-t px-3 py-2 flex items-center justify-between bg-muted/50">
            <span className="text-xs text-muted-foreground">
              {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedFiles(new Set())}>
                Clear
              </Button>
              <Button size="sm" className="text-xs h-7" onClick={sendSelectedToChat}>
                <MessageSquare className="h-3 w-3 mr-1" />
                Send to Chat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 flex flex-col ${!selectedFile ? 'hidden md:flex' : ''}`}>
        {/* Mobile back button */}
        {selectedFile && (
          <div className="md:hidden border-b px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to files
            </Button>
          </div>
        )}
        {fileLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedFile ? (
          <>
            <div className="border-b px-4 py-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">{selectedFile.path.split('/').pop()}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {selectedFile.size !== undefined && <span>{formatSize(selectedFile.size)}</span>}
                  {selectedFile.modifiedAt && (
                    <span>Modified {new Date(selectedFile.modifiedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => {
                  addAttachment({
                    path: selectedFile.path,
                    name: selectedFile.path.split('/').pop() || 'file',
                    size: selectedFile.size,
                    extension: selectedFile.extension,
                  });
                  router.push(`/project/${id}`);
                }}>
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Send to Chat
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (selectedFile.content) {
                    const blob = new Blob([selectedFile.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = selectedFile.path.split('/').pop() || 'file';
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              {selectedFile.binary ? (
                <div className="flex items-center justify-center h-full p-8 text-center">
                  <div>
                    <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Binary file ({formatSize(selectedFile.size)})</p>
                  </div>
                </div>
              ) : (
                <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {selectedFile.content}
                </pre>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a file to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
