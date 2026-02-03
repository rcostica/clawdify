'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ProjectList } from './project-list';
import { ConnectionStatus } from './connection-status';
import { NewProjectDialog } from './new-project-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings, LogOut, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '@/stores/project-store';
import { fetchProjects } from '@/lib/projects';

export function Sidebar() {
  const router = useRouter();
  const supabase = createClient();
  const setProjects = useProjectStore((s) => s.setProjects);
  const setLoading = useProjectStore((s) => s.setLoading);

  // Load projects on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchProjects()
      .then((projects) => {
        if (mounted) {
          setProjects(projects);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Failed to load projects:', err);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [setProjects, setLoading]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out', { description: error.message });
      return;
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="text-xl">🐾</span>
        <h1 className="text-lg font-bold">Clawdify</h1>
      </div>

      <Separator />

      {/* New Project Button */}
      <div className="px-3 py-3">
        <NewProjectDialog />
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-hidden">
        <ProjectList />
      </div>

      <Separator />

      {/* Connection Status */}
      <ConnectionStatus />

      <Separator />

      {/* Footer */}
      <div className="flex flex-col gap-1 px-2 py-2">
        <Link href="/connect">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Wifi className="h-4 w-4" />
            Connection
          </Button>
        </Link>
        <Link href="/settings">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          size="sm"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
