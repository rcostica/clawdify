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
  Mic,
  X,
  Reply as ReplyIcon,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/chat-store';
import { FileUploadButton, FilePreview, type UploadedFile } from './file-upload';

interface MessageInputProps {
  onSend: (content: string) => void;
  onAbort: () => void;
  isConnected: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  projectId?: string;
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
  projectId,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [showVoice, setShowVoice] = useState(false);
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

    // Build message with reply quote and attachments
    let message = '';
    if (replyTo) {
      message += `> ${replyTo.content.split('\n')[0]?.slice(0, 100)}\n\n`;
    }
    message += trimmed;

    // Append file references
    if (attachedFiles.length > 0) {
      message += '\n\n';
      for (const file of attachedFiles) {
        if (file.type.startsWith('image/')) {
          message += `![${file.name}](${file.url})\n`;
        } else {
          message += `[📎 ${file.name}](${file.url})\n`;
        }
      }
    }

    onSend(message);
    setContent('');
    setAttachedFiles([]);
    onCancelReply?.();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, isConnected, isGenerating, replyTo, attachedFiles, onSend, onCancelReply]);

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
              {projectId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <FileUploadButton
                        projectId={projectId}
                        onUpload={(f) =>
                          setAttachedFiles((prev) => [...prev, f])
                        }
                        disabled={!isConnected || disabled}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-8 w-8 text-muted-foreground hover:text-foreground',
                      showVoice && 'text-red-500',
                    )}
                    onClick={() => setShowVoice(!showVoice)}
                    disabled={!isConnected || disabled}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Voice message</TooltipContent>
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

        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {attachedFiles.map((file, i) => (
              <FilePreview
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() =>
                  setAttachedFiles((prev) =>
                    prev.filter((_, j) => j !== i),
                  )
                }
              />
            ))}
          </div>
        )}

        {/* Voice recorder */}
        {showVoice && (
          <div className="mt-2 rounded-lg border">
            <VoiceRecorderInline
              onSend={(text) => {
                onSend(text);
                setShowVoice(false);
              }}
              onCancel={() => setShowVoice(false)}
            />
          </div>
        )}

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

// ── Inline Voice Recorder ──

function VoiceRecorderInline({
  onSend,
  onCancel,
}: {
  onSend: (message: string) => void;
  onCancel: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      onCancel();
    }
  }, [onCancel]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const handleSendVoice = useCallback(() => {
    // For now, voice messages inform the user; full voice transcription
    // would require a speech-to-text service
    onSend(`🎤 Voice message (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`);
  }, [duration, onSend]);

  const formatDur = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {!recording && !audioUrl && (
        <>
          <Button size="sm" onClick={startRecording} className="gap-2">
            <Mic className="h-4 w-4" /> Start Recording
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </>
      )}
      {recording && (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-sm text-red-500">Recording {formatDur(duration)}</span>
          <Button variant="destructive" size="sm" onClick={stopRecording} className="ml-auto gap-2">
            <Square className="h-3 w-3" /> Stop
          </Button>
        </>
      )}
      {audioUrl && !recording && (
        <>
          <audio src={audioUrl} controls className="h-8 flex-1" />
          <Button size="sm" onClick={handleSendVoice} className="gap-2">
            <Send className="h-3 w-3" /> Send
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </>
      )}
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
