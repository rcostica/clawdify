'use client';

import { useEffect, useState } from 'react';
import { 
  ChevronRight, 
  FolderOpen, 
  Plus, 
  LayoutDashboard, 
  FolderKanban, 
  Files,
  Settings,
  LogOut,
  GripVertical
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProjectsStore, buildProjectTree } from '@/lib/stores/projects';
import { toast } from 'sonner';
import type { Project } from '@/lib/db/schema';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ProjectNode = Project & { children: any[] };

function SortableProjectItem({ project }: { project: ProjectNode }) {
  const { selectedProjectId, selectProject } = useProjectsStore();
  const isSelected = selectedProjectId === project.id;
  const hasChildren = project.children.length > 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (hasChildren) {
    return (
      <div ref={setNodeRef} style={style}>
        <Collapsible asChild className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                isActive={isSelected}
                onClick={() => selectProject(project.id)}
              >
                <span
                  className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-3 w-3" />
                </span>
                <span>{project.icon || '📁'}</span>
                <span className="flex-1">{project.name}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {project.children.map((child: ProjectNode) => (
                  <SidebarMenuSubItem key={child.id}>
                    <ProjectTreeItem project={child} level={1} />
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isSelected}
          onClick={() => selectProject(project.id)}
          asChild
        >
          <Link href={`/project/${project.id}`}>
            <span
              className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3 w-3" />
            </span>
            <span>{project.icon || '📁'}</span>
            <span>{project.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
}

function ProjectTreeItem({ project, level = 0 }: { project: ProjectNode; level?: number }) {
  const { selectedProjectId, selectProject } = useProjectsStore();
  const isSelected = selectedProjectId === project.id;
  const hasChildren = project.children.length > 0;

  if (hasChildren) {
    return (
      <Collapsible asChild className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={isSelected}
              onClick={() => selectProject(project.id)}
            >
              <span>{project.icon || '📁'}</span>
              <span className="flex-1">{project.name}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {project.children.map((child: ProjectNode) => (
                <SidebarMenuSubItem key={child.id}>
                  <ProjectTreeItem project={child} level={level + 1} />
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isSelected}
        onClick={() => selectProject(project.id)}
        asChild
      >
        <Link href={`/project/${project.id}`}>
          <span>{project.icon || '📁'}</span>
          <span>{project.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { projects, loading, setProjects, setError, updateProject } = useProjectsStore();
  const pathname = usePathname();
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);
  
  const activeProjects = projects.filter(p => p.status === 'active');
  const projectTree = buildProjectTree(activeProjects);

  // Sort top-level projects by sortOrder
  const sortedTree = [...projectTree].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedTree.findIndex(p => p.id === active.id);
    const newIndex = sortedTree.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedTree, oldIndex, newIndex);

    // Optimistically update local state
    reordered.forEach((p, i) => {
      updateProject(p.id, { sortOrder: i });
    });

    // Persist to server
    for (let i = 0; i < reordered.length; i++) {
      try {
        await fetch(`/api/projects/${reordered[i].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: i }),
        });
      } catch {
        // Silent fail for individual updates
      }
    }
  };

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to fetch projects');
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      }
    }
    fetchProjects();
  }, [setProjects, setError]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      toast.error('Logout failed');
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-2xl">🐒</span>
          <span>Clawdify</span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Projects Section */}
        <SidebarGroup>
          <div className="flex items-center justify-between px-2">
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
              <Link href="/project/new">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                </>
              ) : sortedTree.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/project/new" className="text-muted-foreground">
                      <Plus className="h-4 w-4" />
                      <span>Create first project</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortedTree.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {sortedTree.map((project) => (
                      <SortableProjectItem key={project.id} project={project} />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Views Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === '/'} asChild>
                  <Link href="/">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === '/kanban'} asChild>
                  <Link href="/kanban">
                    <FolderKanban className="h-4 w-4" />
                    <span>Kanban</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === '/files'} asChild>
                  <Link href="/files">
                    <Files className="h-4 w-4" />
                    <span>Files</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === '/settings'} asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} disabled={logoutLoading}>
              <LogOut className="h-4 w-4" />
              <span>{logoutLoading ? 'Logging out...' : 'Logout'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
