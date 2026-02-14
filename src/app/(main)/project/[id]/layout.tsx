'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Files, FolderKanban } from 'lucide-react';
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

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => res.json())
      .then((data) => setProject(data.project))
      .catch(console.error);
  }, [id]);

  const tabs = [
    { href: `/project/${id}`, label: 'Chat', icon: MessageSquare, exact: true },
    { href: `/project/${id}/files`, label: 'Files', icon: Files },
    { href: `/project/${id}/tasks`, label: 'Tasks', icon: FolderKanban },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Project Header with Tabs */}
      <div className="border-b">
        <div className="px-4 pt-3 pb-0 flex items-center gap-3">
          <span className="text-xl">{project?.icon || '📁'}</span>
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-tight">{project?.name || 'Loading...'}</h1>
            {project?.description && (
              <p className="text-xs text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        {/* Tabs: visible only on mobile, hidden on desktop where split-pane is used */}
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
