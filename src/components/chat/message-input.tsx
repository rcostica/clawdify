'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send,
  Square,
  Smile,
  Paperclip,
  Mic,
  MicOff,
  X,
  Reply as ReplyIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/chat-store';

interface MessageInputProps {
  onSend: (content: string) => void;
  onAbort: () => void;
  isConnected: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onAbort,
  isConnected,
  isLoading,
  isStreaming,
  replyTo,
  onCancelReply,
  disabled,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGenerating = isLoading || isStreaming;

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [content]);

  // Focus textarea when replyTo changes
  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || !isConnected || isGenerating) return;

    const message = replyTo
      ? `> ${replyTo.content.split('\n')[0]?.slice(0, 100)}\n\n${trimmed}`
      : trimmed;

    onSend(message);
    setContent('');
    onCancelReply?.();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, isConnected, isGenerating, replyTo, onSend, onCancelReply]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent =
      content.substring(0, start) + emoji + content.substring(end);
    setContent(newContent);
    setShowEmojiPicker(false);
    // Set cursor after emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);
  };

  return (
    <div className="border-t bg-background">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <ReplyIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Replying to {replyTo.role === 'user' ? 'yourself' : 'AI'}
            </p>
            <p className="truncate text-xs text-muted-foreground/70">
              {replyTo.content.slice(0, 120)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCancelReply}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="mx-auto max-w-3xl p-4">
        {/* Connection warning */}
        {!isConnected && (
          <div className="mb-2 rounded-lg border border-yellow-500/30 bg-yellow-50/50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300">
            Not connected to Gateway. Configure your connection in Settings.
          </div>
        )}

        <div className="relative flex items-end gap-2 rounded-xl border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
          {/* Left actions */}
          <div className="flex items-end gap-0.5 pb-2 pl-2">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Emoji</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnected
                ? 'Type a message... (Enter to send, Shift+Enter for newline)'
                : 'Connect to Gateway first...'
            }
            disabled={!isConnected || disabled}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent py-3 text-sm outline-none',
              'placeholder:text-muted-foreground/60',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'max-h-[200px]',
            )}
          />

          {/* Right actions */}
          <div className="flex items-end gap-0.5 pb-2 pr-2">
            {/* Character count */}
            {content.length > 1000 && (
              <span className="pb-1 text-xs text-muted-foreground">
                {content.length}
              </span>
            )}

            {isGenerating ? (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={onAbort}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop generating</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8',
                        content.trim() && isConnected
                          ? 'text-primary hover:text-primary'
                          : 'text-muted-foreground',
                      )}
                      onClick={handleSend}
                      disabled={
                        !content.trim() || !isConnected || disabled
                      }
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={insertEmoji}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Simple Emoji Picker ──

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😊', '🥰', '😍', '🤩', '😎', '🤔', '😅', '😂', '🤣', '😭', '😤', '😱', '🤯', '😈', '👻', '💀', '🤖', '👽'],
  'Gestures': ['👍', '👎', '👋', '🤝', '🙏', '💪', '✌️', '🤞', '🖖', '👏', '🫡', '🫶', '❤️', '🧡', '💛', '💚', '💙', '💜'],
  'Objects': ['💻', '🖥️', '📱', '⌨️', '🖱️', '💡', '🔧', '🛠️', '⚙️', '📁', '📂', '📝', '📊', '📈', '🚀', '⚡', '🔥', '✨', '🎯', '🏆'],
  'Symbols': ['✅', '❌', '⚠️', '❓', '❗', '💯', '🔄', '➡️', '⬆️', '⬇️', '🔒', '🔓', '🔑', '🏷️', '📌', '🔗'],
};

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border bg-popover p-3 shadow-lg">
      <div className="max-h-60 overflow-y-auto space-y-3">
        {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
          <div key={category}>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {category}
            </p>
            <div className="flex flex-wrap gap-0.5">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-accent transition-colors"
                  onClick={() => onSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end border-t pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
