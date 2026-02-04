'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Send, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCreateProps {
  onSubmit: (title: string, description?: string) => void;
  disabled?: boolean;
}

export function TaskCreate({ onSubmit, disabled }: TaskCreateProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay for animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onSubmit(trimmedTitle, description.trim() || undefined);
    setTitle('');
    setDescription('');
    setShowDescription(false);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-muted-foreground"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
        New Task
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          placeholder="What should the agent do?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
          disabled={disabled}
          maxLength={500}
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSubmit}
          disabled={disabled || !title.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showDescription && (
        <Textarea
          placeholder="Optional: add more details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[60px] text-sm resize-none"
          maxLength={2000}
        />
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowDescription(!showDescription)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDescription ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {showDescription ? 'Hide details' : 'Add details'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
