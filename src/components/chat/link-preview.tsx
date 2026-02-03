'use client';

import { useState, useEffect, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
}

// Simple URL detection: find the domain and display it nicely
export function LinkPreview({ url }: LinkPreviewProps) {
  const parsedUrl = useMemo(() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }, [url]);

  if (!parsedUrl) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm hover:bg-muted/50 transition-colors no-underline"
    >
      <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground truncate">
          {parsedUrl.hostname}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {url}
        </p>
      </div>
    </a>
  );
}

/** Detect URLs in text and return them */
export function extractUrls(text: string): string[] {
  const urlRegex =
    /https?:\/\/[^\s<>\[\]()'"]+(?:\([^\s<>\[\]()'"]*\)|[^\s<>\[\]()'".,;:!?])/g;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}
