'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, File, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface FileUploadProps {
  projectId: string;
  onUpload: (file: UploadedFile) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
];

export function FileUploadButton({
  projectId,
  onUpload,
  disabled,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File too large', {
          description: 'Maximum file size is 10MB',
        });
        return;
      }

      // Validate type
      if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('text/')) {
        toast.error('Unsupported file type', {
          description: `${file.type || 'unknown'} is not supported`,
        });
        return;
      }

      setUploading(true);
      try {
        const supabase = createClient();
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          toast.error('Upload failed', { description: error.message });
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(data.path);

        onUpload({
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
        });
      } catch (err) {
        toast.error('Upload failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setUploading(false);
      }
    },
    [projectId, onUpload],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept={ALLOWED_TYPES.join(',')}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>
    </>
  );
}

/** Preview for an attached file before sending */
export function FilePreview({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith('image/');

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      {isImage ? (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      ) : (
        <File className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
      <span className="text-xs text-muted-foreground">
        {(file.size / 1024).toFixed(0)}KB
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
