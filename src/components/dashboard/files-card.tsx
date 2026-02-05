'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FolderOpen,
  ArrowRight,
  FileCode,
  FileJson,
  FileText,
  File,
  FileType,
} from 'lucide-react';

interface RecentFile {
  path: string;
  name: string;
  extension: string;
  modifiedAt: string;
}

// Mock data — will be replaced with real file tracking
const MOCK_FILES: RecentFile[] = [
  { path: 'src/app/page.tsx', name: 'page.tsx', extension: 'tsx', modifiedAt: '2m ago' },
  { path: 'src/components/hero.tsx', name: 'hero.tsx', extension: 'tsx', modifiedAt: '5m ago' },
  { path: 'package.json', name: 'package.json', extension: 'json', modifiedAt: '12m ago' },
  { path: 'src/lib/utils.ts', name: 'utils.ts', extension: 'ts', modifiedAt: '1h ago' },
  { path: 'README.md', name: 'README.md', extension: 'md', modifiedAt: '2h ago' },
];

const extensionIcons: Record<string, typeof File> = {
  tsx: FileCode,
  ts: FileCode,
  jsx: FileCode,
  js: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  css: FileType,
  scss: FileType,
};

export function FilesCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-4 w-4" />
          Recent Files
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {MOCK_FILES.map((file) => {
          const Icon = extensionIcons[file.extension] ?? File;
          return (
            <div
              key={file.path}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground truncate">{file.path}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {file.modifiedAt}
              </span>
            </div>
          );
        })}
        <Link
          href="/files"
          className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Browse All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
