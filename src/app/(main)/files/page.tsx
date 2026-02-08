'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Folder, FileText, FileCode, FileImage, File as FileIcon,
  ChevronRight, ChevronDown, ArrowLeft, Home, Download,
  Plus, FolderPlus, Trash2, Loader2
} from 'lucide-react';

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

function getLanguage(ext?: string): string {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', sh: 'bash', json: 'json', yaml: 'yaml', yml: 'yaml',
    toml: 'toml', md: 'markdown', css: 'css', html: 'html', sql: 'sql',
  };
  return map[ext || ''] || 'text';
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
      if (!res.ok) throw new Error('Failed to load directory');
      const data = await res.json();
      setEntries(data.entries || []);
      setCurrentPath(dirPath);
      setSelectedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFile = useCallback(async (filePath: string) => {
    setFileLoading(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to load file');
      const data = await res.json();
      setSelectedFile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setFileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectory('');
  }, [fetchDirectory]);

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      fetchDirectory(entry.path);
    } else {
      fetchFile(entry.path);
    }
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/');
    fetchDirectory(parent);
  };

  const goHome = () => {
    fetchDirectory('');
  };

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)]">
      {/* File List Panel */}
      <div className={`w-full md:w-80 border-r flex flex-col ${selectedFile ? 'hidden md:flex' : ''}`}>
        {/* Breadcrumb / Navigation */}
        <div className="border-b px-3 py-2 flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goHome}>
            <Home className="h-3.5 w-3.5" />
          </Button>
          {currentPath && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goUp}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="flex-1 text-xs text-muted-foreground truncate ml-1">
            {currentPath ? `/${currentPath}` : '/workspace'}
          </div>
        </div>

        {/* Breadcrumb Trail */}
        {breadcrumbs.length > 0 && (
          <div className="px-3 py-1.5 border-b flex flex-wrap items-center gap-0.5 text-xs">
            <button 
              onClick={goHome}
              className="text-muted-foreground hover:text-foreground"
            >
              workspace
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button
                  onClick={() => {
                    const crumbPath = breadcrumbs.slice(0, i + 1).join('/');
                    fetchDirectory(crumbPath);
                  }}
                  className={`hover:text-foreground ${
                    i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {crumb}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* File List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">{error}</div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Empty directory
            </div>
          ) : (
            <div className="py-1">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left ${
                    selectedFile?.path === entry.path ? 'bg-muted' : ''
                  }`}
                >
                  {getFileIcon(entry)}
                  <span className="flex-1 truncate">{entry.name}</span>
                  {entry.size !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {formatSize(entry.size)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* File Content Panel */}
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
            {/* File Header */}
            <div className="border-b px-4 py-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">
                  {selectedFile.path.split('/').pop()}
                </h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {selectedFile.size !== undefined && (
                    <span>{formatSize(selectedFile.size)}</span>
                  )}
                  {selectedFile.extension && (
                    <span>.{selectedFile.extension}</span>
                  )}
                  {selectedFile.modifiedAt && (
                    <span>Modified {new Date(selectedFile.modifiedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedFile.content) {
                    const blob = new Blob([selectedFile.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = selectedFile.path.split('/').pop() || 'file';
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>

            {/* File Content */}
            <ScrollArea className="flex-1">
              {selectedFile.binary ? (
                <div className="flex items-center justify-center h-full p-8">
                  <div className="text-center">
                    <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Binary file ({formatSize(selectedFile.size)})
                    </p>
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
              <p className="text-sm text-muted-foreground">
                Select a file to view its contents
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
