'use client';

interface ImagePreviewProps {
  content: string;
  name?: string;
}

export function ImagePreview({ content, name }: ImagePreviewProps) {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={content}
        alt={name ?? 'Image preview'}
        className="max-h-full max-w-full object-contain rounded"
      />
    </div>
  );
}
