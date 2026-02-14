'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setTheme(isDark ? 'light' : 'dark')}>
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
