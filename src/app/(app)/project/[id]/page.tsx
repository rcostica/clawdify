'use client';

import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-lg">{project?.icon ?? '📁'}</span>
        <h2 className="font-semibold">{project?.name ?? 'Project'}</h2>
      </div>

      {/* Chat messages area - Phase 5 */}
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">Chat interface coming in Phase 5</p>
      </div>

      {/* Message input - Phase 5 */}
      <div className="border-t p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
            Type a message... (Phase 5)
          </div>
        </div>
      </div>
    </div>
  );
}
