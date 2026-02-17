'use client';

import { useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  FileText, ChevronRight, ChevronDown, Folder, ArrowLeft, BookOpen,
  Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Project } from '@/lib/db/schema';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: TreeNode[];
}

function isMarkdownFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ext === 'md' || ext === 'mdx';
}

async function fetchMarkdownTree(basePath: string, subPath: string = ''): Promise<TreeNode[]> {
  const fullPath = subPath ? `${basePath}/${subPath}` : basePath;
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(fullPath)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const entries: FileEntry[] = data.entries || [];
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      if (entry.type === 'directory') {
        const relPath = entry.path.startsWith(basePath + '/')
          ? entry.path.slice(basePath.length + 1)
          : entry.path.replace(basePath, '').replace(/^\//, '');
        const children = await fetchMarkdownTree(basePath, relPath);
        if (children.length > 0) {
          nodes.push({ name: entry.name, path: entry.path, type: 'directory', children });
        }
      } else if (isMarkdownFile(entry.name)) {
        nodes.push({ name: entry.name, path: entry.path, type: 'file', children: [] });
      }
    }

    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch {
    return [];
  }
}

function TreeItem({
  node,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selectedPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = node.path === selectedPath;

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-muted transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <Folder className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors ${
        isSelected ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-purple-500' : 'text-muted-foreground'}`} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function findFile(nodes: TreeNode[], predicate: (name: string) => boolean): TreeNode | null {
  for (const node of nodes) {
    if (node.type === 'file' && predicate(node.name)) return node;
    if (node.type === 'directory') {
      const found = findFile(node.children, predicate);
      if (found) return found;
    }
  }
  return null;
}

export function DocsPanel({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

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

  useEffect(() => {
    if (!basePath) return;
    setTreeLoading(true);
    fetchMarkdownTree(basePath).then((nodes) => {
      setTree(nodes);
      setTreeLoading(false);
      const readme = findFile(nodes, (name) =>
        name.toLowerCase() === 'readme.md' || name.toLowerCase() === 'readme.mdx'
      );
      if (readme) setSelectedPath(readme.path);
    });
  }, [basePath]);

  useEffect(() => {
    if (!selectedPath) {
      setFileContent(null);
      return;
    }
    setFileLoading(true);
    fetch(`/api/files?path=${encodeURIComponent(selectedPath)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load file');
        return res.json();
      })
      .then((data) => setFileContent(data.content || ''))
      .catch(() => setFileContent('*Failed to load file.*'))
      .finally(() => setFileLoading(false));
  }, [selectedPath]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fileName = selectedPath ? selectedPath.split('/').pop() : null;

  // In panel mode (embedded in main page), show a simpler single-column view
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {selectedPath && fileContent !== null ? (
        <>
          <div className="border-b px-3 py-2 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedPath('')}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <h2 className="text-xs font-medium truncate">{fileName}</h2>
          </div>
          {fileLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <article className="prose prose-sm dark:prose-invert max-w-none p-4">
                <ReactMarkdown>{fileContent}</ReactMarkdown>
              </article>
            </ScrollArea>
          )}
        </>
      ) : (
        <>
          <div className="border-b px-3 py-2 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate flex-1">Documentation</span>
          </div>
          <ScrollArea className="flex-1">
            {treeLoading ? (
              <div className="py-1 space-y-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-3.5 w-3.5 rounded" />
                    <Skeleton className="h-3.5 flex-1" />
                  </div>
                ))}
              </div>
            ) : tree.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p>No markdown files found.</p>
                <p className="mt-1">Add <code className="text-[10px] bg-muted px-1 py-0.5 rounded">.md</code> or <code className="text-[10px] bg-muted px-1 py-0.5 rounded">.mdx</code> files to your project.</p>
              </div>
            ) : (
              <div className="py-1">
                {tree.map((node) => (
                  <TreeItem
                    key={node.path}
                    node={node}
                    selectedPath={selectedPath}
                    onSelect={setSelectedPath}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
