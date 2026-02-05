'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ArrowRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  humanSchedule: string;
  enabled: boolean;
  lastRun?: string;
}

// Mock data — will be replaced with real cron jobs from Gateway
const MOCK_CRONS: CronJob[] = [
  {
    id: '1',
    name: 'Daily standup summary',
    schedule: '0 9 * * 1-5',
    humanSchedule: 'Weekdays at 9:00 AM',
    enabled: true,
    lastRun: '1d ago',
  },
  {
    id: '2',
    name: 'Weekly report',
    schedule: '0 17 * * 5',
    humanSchedule: 'Fridays at 5:00 PM',
    enabled: true,
    lastRun: '4d ago',
  },
  {
    id: '3',
    name: 'Backup workspace',
    schedule: '0 3 * * *',
    humanSchedule: 'Daily at 3:00 AM',
    enabled: false,
  },
];

export function CronsCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Crons
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {MOCK_CRONS.map((cron) => (
          <div
            key={cron.id}
            className="flex items-start gap-2.5 rounded-md px-2 py-1.5"
          >
            <Circle
              className={cn(
                'h-2 w-2 mt-1.5 shrink-0 fill-current',
                cron.enabled ? 'text-green-500' : 'text-muted-foreground/50'
              )}
            />
            <div className="min-w-0 flex-1">
              <p className={cn(
                'text-sm truncate',
                !cron.enabled && 'text-muted-foreground'
              )}>
                {cron.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {cron.humanSchedule}
              </p>
            </div>
          </div>
        ))}
        <Link
          href="/crons"
          className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage Crons
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
