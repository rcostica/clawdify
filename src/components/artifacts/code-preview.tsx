'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, WrapText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodePreviewProps {
  content: string;
  language?: string;
}

export function CodePreview({ content, language }: CodePreviewProps) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const lines = content.split('\n');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          {language && (
            <Badge variant="secondary" className="text-xs">
              {language}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {lines.length} lines
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setWrap(!wrap)}
          >
            <WrapText
              className={cn('h-3.5 w-3.5', wrap && 'text-primary')}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto bg-muted/30 p-4 font-mono text-xs">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="select-none pr-4 text-right text-muted-foreground/50 align-top w-8">
                  {i + 1}
                </td>
                <td className={cn(wrap ? 'whitespace-pre-wrap' : 'whitespace-pre')}>
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
