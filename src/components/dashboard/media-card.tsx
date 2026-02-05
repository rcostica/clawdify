'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Image, ArrowRight } from 'lucide-react';

interface MediaItem {
  id: string;
  type: 'image' | 'artifact';
  thumbnail?: string;
}

// Mock data — will be replaced with real artifact/media tracking
const MOCK_MEDIA: MediaItem[] = [
  { id: '1', type: 'image' },
  { id: '2', type: 'artifact' },
  { id: '3', type: 'image' },
  { id: '4', type: 'artifact' },
];

const TOTAL_MEDIA = 12; // Mock total count

export function MediaCard() {
  const displayItems = MOCK_MEDIA.slice(0, 4);
  const moreCount = TOTAL_MEDIA - displayItems.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Image className="h-4 w-4" />
          Media
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {displayItems.map((item, i) => (
            <div
              key={item.id}
              className="aspect-square rounded-md bg-muted/50 border border-border/50 flex items-center justify-center relative overflow-hidden"
            >
              {/* Placeholder — will show real thumbnails */}
              <Image className="h-6 w-6 text-muted-foreground/30" />
              
              {/* Show +N overlay on last item if there are more */}
              {i === displayItems.length - 1 && moreCount > 0 && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    +{moreCount}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        <Link
          href="/gallery"
          className="flex items-center justify-center gap-1 pt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View Gallery
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
