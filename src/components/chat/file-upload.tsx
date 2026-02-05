'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, File, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface FileUploadProps {
  onUpload: (file: UploadedFile) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for data URLs
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
];

export function FileUploadButton({
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
          description: 'Maximum file size is 5MB',
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
        // Convert to data URL (self-hosted, no cloud storage)
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          onUpload({
            name: file.name,
            url: dataUrl,
            type: file.type,
            size: file.size,
          });
          setUploading(false);
        };
        reader.onerror = () => {
          toast.error('Failed to read file');
          setUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        toast.error('Upload failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
        setUploading(false);
      }
    },
    [onUpload],
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
