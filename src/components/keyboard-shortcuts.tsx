'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Global keyboard shortcuts:
 * - Cmd/Ctrl + N: New project
 * - Cmd/Ctrl + Shift + N: New task (from project page)
 * - Cmd/Ctrl + ,: Settings
 * - Cmd/Ctrl + B: Toggle sidebar (handled by shadcn/ui)
 * - Cmd/Ctrl + K: Search (handled by search-modal)
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only trigger on Cmd/Ctrl
      if (!e.metaKey && !e.ctrlKey) return;
      
      // Don't trigger in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          if (e.shiftKey) {
            // Cmd+Shift+N: New task (only on project pages)
            const projectMatch = pathname.match(/\/project\/(\d+)/);
            if (projectMatch) {
              e.preventDefault();
              router.push(`/project/${projectMatch[1]}/tasks?new=1`);
            }
          } else {
            // Cmd+N: New project
            e.preventDefault();
            router.push('/project/new');
          }
          break;
        case ',':
          // Cmd+,: Settings
          e.preventDefault();
          router.push('/settings');
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router, pathname]);

  return null;
}
