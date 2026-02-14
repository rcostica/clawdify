'use client';

export function SearchTrigger() {
  return (
    <button
      onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
      className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-1.5 bg-muted/50"
    >
      <span>Search...</span>
      <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
