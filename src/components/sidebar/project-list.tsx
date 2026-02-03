'use client';

import { useProjectStore, type Project } from '@/stores/project-store';
import { useRouter, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

function ProjectItem({
  project,
  isActive,
  onClick,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground font-medium',
      )}
    >
      <span className="text-lg leading-none">{project.icon}</span>
      <span className="truncate">{project.name}</span>
    </button>
  );
}

export function ProjectList() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const router = useRouter();
  const params = useParams();
  const currentId = params?.id as string | undefined;

  if (loading) {
    return (
      <div className="space-y-2 px-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No projects yet.
        <br />
        Create one to get started!
      </div>
    );
  }

  const visibleProjects = projects.filter((p) => !p.archived);

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1 px-2">
        {visibleProjects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            isActive={
              project.id === (currentId ?? activeProjectId)
            }
            onClick={() => {
              setActiveProject(project.id);
              router.push(`/project/${project.id}`);
            }}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
