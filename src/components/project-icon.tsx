'use client';

/**
 * Renders a project icon — either an emoji or an uploaded image.
 * Convention: if icon value contains a '/' or starts with '_uploads', it's an image path.
 */
export function ProjectIcon({ icon, size = 'md', className = '' }: { icon?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const value = icon || '📁';
  const isImage = value.includes('/') || value.includes('.');

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  if (isImage) {
    return (
      <img
        src={`/api/files?path=${encodeURIComponent(value)}`}
        alt=""
        className={`${sizeClasses[size]} rounded-sm object-cover ${className}`}
      />
    );
  }

  return <span className={`${textSizes[size]} leading-none ${className}`}>{value}</span>;
}
