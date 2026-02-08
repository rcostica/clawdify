'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, CheckCircle, Download, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SessionInfo {
  id: string;
  filename: string;
  messageCount: number;
  firstMessage?: string;
  size: number;
  modifiedAt: string;
}

export default function MigrationPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/migration/sessions');
        const data = await res.json();
        setSessions(data.sessions || []);
        // Pre-fill project names from first message
        const names: Record<string, string> = {};
        for (const s of data.sessions || []) {
          const preview = s.firstMessage?.substring(0, 50)?.replace(/[^a-zA-Z0-9 ]/g, '').trim() || `Session ${s.id.substring(0, 8)}`;
          names[s.id] = preview;
        }
        setProjectNames(names);
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  const handleImport = async (sessionId: string) => {
    const projectName = projectNames[sessionId]?.trim();
    if (!projectName) return;
    setImporting(sessionId);
    try {
      const res = await fetch('/api/migration/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, projectName }),
      });
      const data = await res.json();
      if (res.ok) {
        setImported(prev => new Set([...prev, sessionId]));
      } else {
        alert(data.error || 'Import failed');
      }
    } catch {
      alert('Import failed');
    } finally {
      setImporting(null);
    }
  };

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Migration Wizard</h1>
          <p className="text-sm text-muted-foreground">Import OpenClaw sessions as projects</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No sessions found to import</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{sessions.length} sessions found</p>
          {sessions.map(session => (
            <Card key={session.id} className={imported.has(session.id) ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{session.messageCount} messages</span>
                      <span className="text-xs text-muted-foreground">· {formatSize(session.size)}</span>
                      <span className="text-xs text-muted-foreground">· {new Date(session.modifiedAt).toLocaleDateString()}</span>
                    </div>
                    {session.firstMessage && (
                      <p className="text-xs text-muted-foreground truncate">{session.firstMessage}</p>
                    )}
                    <Input
                      value={projectNames[session.id] || ''}
                      onChange={e => setProjectNames(prev => ({ ...prev, [session.id]: e.target.value }))}
                      placeholder="Project name..."
                      className="h-8 text-sm mt-1"
                      disabled={imported.has(session.id)}
                    />
                  </div>
                  <div className="shrink-0">
                    {imported.has(session.id) ? (
                      <Button variant="ghost" size="sm" disabled className="gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" /> Imported
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleImport(session.id)}
                        disabled={importing === session.id || !projectNames[session.id]?.trim()}
                        className="gap-1"
                      >
                        {importing === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Import
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
