'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Files, FolderKanban, BookOpen, Plus, ChevronRight, Download, Loader2, Pencil, Archive } from 'lucide-react';
import { EmojiPicker } from '@/components/emoji-picker';
import { ProjectIcon } from '@/components/project-icon';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { Project } from '@/lib/db/schema';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);
  const [parentProject, setParentProject] = useState<Project | null>(null);
  const [childCount, setChildCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const router = useRouter();

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to archive');
      router.push('/');
    } catch {
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  };

  const handleIconChange = async (emoji: string) => {
    if (!project) return;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon: emoji }),
      });
      if (!res.ok) throw new Error('Failed to update icon');
      const data = await res.json();
      setProject(data.project);
      setEditingIcon(false);
    } catch {
      // silent fail
    }
  };

  // Close icon picker on click outside
  useEffect(() => {
    if (!editingIcon) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-icon-picker]')) {
        setEditingIcon(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [editingIcon]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${id}/export`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'project-export.tar.gz';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Project exported');
    } catch {
      toast.error('Failed to export project');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProject(data.project);
        // Fetch parent if this project has one
        if (data.project?.parentId) {
          fetch(`/api/projects/${data.project.parentId}`)
            .then((res) => res.json())
            .then((pData) => setParentProject(pData.project || null))
            .catch(console.error);
        }
      })
      .catch(console.error);

    // Count children
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        const children = (data.projects || []).filter(
          (p: Project) => p.parentId === id && p.status === 'active'
        );
        setChildCount(children.length);
      })
      .catch(console.error);
  }, [id]);

  const tabs = [
    { href: `/project/${id}`, label: 'Chat', icon: MessageSquare, exact: true },
    { href: `/project/${id}/files`, label: 'Files', icon: Files },
    { href: `/project/${id}/tasks`, label: 'Tasks', icon: FolderKanban },
    { href: `/project/${id}/docs`, label: 'Docs', icon: BookOpen },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Project Header with Tabs */}
      <div className="border-b">
        {/* Parent breadcrumb */}
        {parentProject && (
          <div className="px-4 pt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Link
              href={`/project/${parentProject.id}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ProjectIcon icon={parentProject.icon} size="sm" />
              {parentProject.name}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{project?.name || '...'}</span>
          </div>
        )}
        <div className={`px-4 ${parentProject ? 'pt-1' : 'pt-3'} pb-0 flex items-center gap-3`}>
          <div className="relative">
            <button
              data-icon-picker
              onClick={() => setEditingIcon(!editingIcon)}
              className="text-xl hover:bg-muted rounded-md p-1 transition-colors group"
              title="Change icon"
            >
              <ProjectIcon icon={project?.icon} size="xl" />
              <Pencil className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            {editingIcon && (
              <div data-icon-picker className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg p-3 w-[340px]">
                <EmojiPicker selected={project?.icon || '📁'} onSelect={handleIconChange} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold leading-tight truncate">{project?.name || 'Loading...'}</h1>
              {childCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
                  {childCount} sub-project{childCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {project?.description && (
              <p className="text-xs text-muted-foreground">{project.description}</p>
            )}
          </div>
          {/* Archive project button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowArchiveConfirm(true)}>
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive project</TooltipContent>
          </Tooltip>
          {/* Export project button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export project</TooltipContent>
          </Tooltip>
          {/* New Sub-Project button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                <Link href={`/project/new?parentId=${id}`}>
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>New sub-project</TooltipContent>
          </Tooltip>
        </div>
        {/* Tabs: only on sub-pages (files/tasks), hidden on main project page which has its own tabs */}
        {pathname !== `/project/${id}` && (
          <div className="flex px-4 mt-2 gap-1 lg:hidden">
            {tabs.map((tab) => {
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary text-foreground font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Archive confirmation modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowArchiveConfirm(false)}>
          <div className="bg-background border rounded-lg shadow-lg w-[400px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold">Archive project?</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>{project?.name}</strong> will be hidden from the sidebar. You can restore it later from Settings.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              No files or data will be deleted. The project workspace remains intact.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowArchiveConfirm(false)} disabled={archiving}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleArchive} disabled={archiving} className="bg-amber-600 hover:bg-amber-700 text-white">
                {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Archive className="h-3.5 w-3.5 mr-1.5" />}
                Archive
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
