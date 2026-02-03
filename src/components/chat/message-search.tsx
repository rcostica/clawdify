'use client';

import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/chat-store';

interface MessageSearchProps {
  messages: ChatMessage[];
  onClose: () => void;
  onJumpTo?: (messageId: string) => void;
}

export function MessageSearch({
  messages,
  onClose,
  onJumpTo,
}: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Search messages
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setCurrentIndex(0);
      return;
    }
    const q = query.toLowerCase();
    const found = messages.filter((m) =>
      m.content.toLowerCase().includes(q),
    );
    setResults(found);
    setCurrentIndex(0);
    // Jump to first result
    if (found[0] && onJumpTo) {
      onJumpTo(found[0].id);
    }
  }, [query, messages, onJumpTo]);

  const navigateResult = useCallback(
    (direction: 'next' | 'prev') => {
      if (results.length === 0) return;
      let next: number;
      if (direction === 'next') {
        next = (currentIndex + 1) % results.length;
      } else {
        next = (currentIndex - 1 + results.length) % results.length;
      }
      setCurrentIndex(next);
      const msg = results[next];
      if (msg && onJumpTo) onJumpTo(msg.id);
    },
    [currentIndex, results, onJumpTo],
  );

  return (
    <div className="flex items-center gap-2 border-b bg-background px-3 py-2">
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search messages..."
        className="h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            navigateResult(e.shiftKey ? 'prev' : 'next');
          }
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      />
      {results.length > 0 && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {currentIndex + 1} / {results.length}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigateResult('prev')}
          disabled={results.length === 0}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigateResult('next')}
          disabled={results.length === 0}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
