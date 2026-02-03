'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useProjectStore } from '@/stores/project-store';
import { useGatewayStore } from '@/stores/gateway-store';
import {
  FolderOpen,
  Plus,
  Settings,
  Wifi,
  Download,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';

interface CommandPaletteProps {
  onNewProject?: () => void;
  onImport?: () => void;
}

export function CommandPalette({ onNewProject, onImport }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const { setTheme, theme } = useTheme();

  // Global keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // Cmd+N: New project
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onNewProject?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewProject]);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Projects */}
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects
              .filter((p) => !p.archived)
              .map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() =>
                    runCommand(() => router.push(`/project/${project.id}`))
                  }
                >
                  <span className="mr-2 text-lg">{project.icon}</span>
                  <span>{project.name}</span>
                  {project.description && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">
                      {project.description}
                    </span>
                  )}
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Actions */}
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => onNewProject?.())}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </CommandItem>
          {isConnected && (
            <CommandItem
              onSelect={() => runCommand(() => onImport?.())}
            >
              <Download className="mr-2 h-4 w-4" />
              Import from Gateway
            </CommandItem>
          )}
          <CommandItem
            onSelect={() => runCommand(() => router.push('/settings'))}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/connect'))}
          >
            <Wifi className="mr-2 h-4 w-4" />
            Connection
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Theme */}
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            Light Mode
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            Dark Mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
