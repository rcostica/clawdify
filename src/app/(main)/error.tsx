'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MainLayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Main layout error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Error loading this page</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        {error.message || 'Something went wrong. Please try again.'}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
        <Button onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    </div>
  );
}
