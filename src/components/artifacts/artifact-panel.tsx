'use client';

import { useState } from 'react';
import type { DetectedArtifact } from '@/lib/artifacts/detector';
import { HtmlPreview } from './html-preview';
import { CodePreview } from './code-preview';
import { MarkdownPreview } from './markdown-preview';
import { ImagePreview } from './image-preview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactPanelProps {
  artifacts: DetectedArtifact[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function ArtifactPanel({
  artifacts,
  selectedId,
  onSelect,
  onClose,
}: ArtifactPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const selected = artifacts.find((a) => a.id === selectedId) ?? artifacts[0];

  if (!selected) return null;

  return (
    <div
      className={cn(
        'flex flex-col border-l bg-background',
        expanded ? 'fixed inset-0 z-50' : 'h-full',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="text-xs shrink-0">
            {selected.type}
          </Badge>
          <span className="text-sm font-medium truncate">{selected.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tab bar (if multiple artifacts) */}
      {artifacts.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5">
          {artifacts.map((a) => (
            <button
              key={a.id}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors',
                a.id === selected.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => onSelect(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Preview */}
      <div className="flex-1 overflow-hidden">
        {selected.type === 'html' && (
          <HtmlPreview content={selected.content} />
        )}
        {selected.type === 'code' && (
          <CodePreview
            content={selected.content}
            language={selected.language}
          />
        )}
        {selected.type === 'markdown' && (
          <MarkdownPreview content={selected.content} />
        )}
        {selected.type === 'image' && (
          <ImagePreview
            content={selected.content}
            name={selected.name}
          />
        )}
      </div>
    </div>
  );
}
