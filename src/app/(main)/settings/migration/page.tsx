'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Download,
  Upload,
  Package,
  AlertTriangle,
  FolderOpen,
  MessageSquare,
  ListTodo,
  Settings2,
  FileText,
  XCircle,
  ArrowRight,
  SkipForward,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// ---------- Types ----------
interface ProjectInfo {
  id: string;
  name: string;
  icon?: string;
  status?: string;
  workspacePath?: string;
  threadCount: number;
  messageCount: number;
  taskCount: number;
  hasWorkspaceFiles: boolean;
  conflict: boolean;
  conflictProjectId?: string;
}

interface AnalysisResult {
  valid: boolean;
  error?: string;
  metadata: {
    version: number;
    createdAt: string;
    hostname: string;
    stats: {
      projects: number;
      threads: number;
      messages: number;
      tasks: number;
      settings: number;
      sessionSummaries: number;
    };
  } | null;
  projects: ProjectInfo[];
  orphanedThreads: { id: string; title: string; messageCount: number }[];
  settingsCount: number;
  summariesCount: number;
  totalSizeBytes: number;
}

interface ImportResults {
  projectsImported: number;
  projectsSkipped: number;
  threadsImported: number;
  messagesImported: number;
  tasksImported: number;
  settingsImported: number;
  summariesImported: number;
  workspaceFilesRestored: number;
  orphanedThreads: number;
  errors: string[];
}

type WizardStep = 'idle' | 'analyzing' | 'review' | 'importing' | 'done';

// ---------- Component ----------
export default function MigrationPage() {
  // Export state
  const [exporting, setExporting] = useState(false);

  // Import state
  const [step, setStep] = useState<WizardStep>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [skipProjects, setSkipProjects] = useState<Set<string>>(new Set());
  const [importSettings, setImportSettings] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- Export ----------
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/migration/export', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'clawdify-migration.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Migration archive downloaded');
    } catch {
      toast.error('Failed to create migration archive');
    } finally {
      setExporting(false);
    }
  };

  // ---------- Import: Analyze ----------
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('analyzing');
    setAnalysis(null);
    setSkipProjects(new Set());
    setImportSettings(false);
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append('archive', selectedFile);
      const res = await fetch('/api/migration/import/analyze', {
        method: 'POST',
        body: formData,
      });
      const data: AnalysisResult = await res.json();

      if (!data.valid) {
        toast.error(data.error || 'Invalid archive');
        setStep('idle');
        setFile(null);
        return;
      }

      // Auto-skip conflicting projects
      const conflicts = new Set<string>();
      for (const proj of data.projects) {
        if (proj.conflict) conflicts.add(proj.id);
      }
      setSkipProjects(conflicts);
      setAnalysis(data);
      setStep('review');
    } catch {
      toast.error('Failed to analyze archive');
      setStep('idle');
      setFile(null);
    }
  }, []);

  // ---------- Import: Execute ----------
  const handleImport = async () => {
    if (!file || !analysis) return;
    setStep('importing');

    try {
      const formData = new FormData();
      formData.append('archive', file);
      formData.append('skipProjects', JSON.stringify([...skipProjects]));
      formData.append('importSettings', String(importSettings));

      const res = await fetch('/api/migration/import/execute', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Import failed');
        setStep('review');
        return;
      }

      setImportResults(data.results);
      setStep('done');
      toast.success('Migration import completed!');
    } catch {
      toast.error('Import failed');
      setStep('review');
    }
  };

  // ---------- Reset ----------
  const handleReset = () => {
    setStep('idle');
    setFile(null);
    setAnalysis(null);
    setSkipProjects(new Set());
    setImportSettings(false);
    setImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---------- Helpers ----------
  const toggleSkip = (projectId: string) => {
    setSkipProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const projectsToImport = analysis?.projects.filter(p => !skipProjects.has(p.id)) || [];

  // ---------- Render ----------
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Migration Wizard</h1>
          <p className="text-sm text-muted-foreground">Transfer your entire Clawdify workspace between machines</p>
        </div>
      </div>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Export
          </CardTitle>
          <CardDescription>
            Package your entire workspace into a single .zip file — database, projects, workspace files, settings, and conversation history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? 'Creating archive...' : 'Export Everything'}
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import
          </CardTitle>
          <CardDescription>
            Upload a migration archive from another machine. You&apos;ll review the contents before anything is imported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step: Idle - file upload */}
          {step === 'idle' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Select Migration Archive (.zip)
              </Button>
            </div>
          )}

          {/* Step: Analyzing */}
          {step === 'analyzing' && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Analyzing archive...</span>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && analysis && (
            <div className="space-y-4">
              {/* Archive Summary */}
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Archive Summary</h3>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(analysis.totalSizeBytes)} · from {analysis.metadata?.hostname}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Exported {analysis.metadata?.createdAt ? new Date(analysis.metadata.createdAt).toLocaleString() : 'unknown'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <StatBadge icon={<FolderOpen className="h-3.5 w-3.5" />} label="Projects" value={analysis.metadata?.stats.projects ?? 0} />
                  <StatBadge icon={<MessageSquare className="h-3.5 w-3.5" />} label="Messages" value={analysis.metadata?.stats.messages ?? 0} />
                  <StatBadge icon={<ListTodo className="h-3.5 w-3.5" />} label="Tasks" value={analysis.metadata?.stats.tasks ?? 0} />
                  <StatBadge icon={<FileText className="h-3.5 w-3.5" />} label="Summaries" value={analysis.metadata?.stats.sessionSummaries ?? 0} />
                </div>
              </div>

              {/* Project List */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Projects</h3>
                {analysis.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects found in archive</p>
                ) : (
                  <div className="space-y-2">
                    {analysis.projects.map(proj => {
                      const isSkipped = skipProjects.has(proj.id);
                      return (
                        <div
                          key={proj.id}
                          className={`rounded-lg border p-3 flex items-start gap-3 transition-opacity ${isSkipped ? 'opacity-50' : ''}`}
                        >
                          <span className="text-lg mt-0.5">{proj.icon || '📁'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{proj.name}</span>
                              {proj.status === 'archived' && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">archived</span>
                              )}
                              {proj.conflict && (
                                <span className="text-xs bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> conflict
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>{proj.threadCount} threads</span>
                              <span>{proj.messageCount} messages</span>
                              <span>{proj.taskCount} tasks</span>
                              {proj.hasWorkspaceFiles && <span>📂 workspace files</span>}
                            </div>
                          </div>
                          <Button
                            variant={isSkipped ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => toggleSkip(proj.id)}
                            className="shrink-0 text-xs gap-1"
                          >
                            {isSkipped ? (
                              <>
                                <SkipForward className="h-3 w-3" /> Skipped
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3" /> Import
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Orphaned Threads */}
              {analysis.orphanedThreads.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 p-3 bg-amber-500/5 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    {analysis.orphanedThreads.length} Orphaned Thread{analysis.orphanedThreads.length > 1 ? 's' : ''}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These threads reference projects not found in the archive. They will be skipped.
                  </p>
                  {analysis.orphanedThreads.map(t => (
                    <div key={t.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <MessageSquare className="h-3 w-3" />
                      {t.title} ({t.messageCount} messages)
                    </div>
                  ))}
                </div>
              )}

              {/* Settings toggle */}
              {analysis.settingsCount > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importSettings}
                    onChange={e => setImportSettings(e.target.checked)}
                    className="rounded"
                  />
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Import {analysis.settingsCount} settings (won&apos;t overwrite existing)
                </label>
              )}

              {/* Import summary & actions */}
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Import Plan</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Will import {projectsToImport.length} project{projectsToImport.length !== 1 ? 's' : ''}
                  {skipProjects.size > 0 ? `, skip ${skipProjects.size}` : ''}.
                  {' '}Existing data will not be overwritten.
                </p>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleImport} disabled={projectsToImport.length === 0} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Import {projectsToImport.length} Project{projectsToImport.length !== 1 ? 's' : ''}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Importing data and restoring workspace files...</span>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && importResults && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-500/30 p-4 bg-green-500/5">
                <div className="flex items-center gap-2 text-green-600 font-medium mb-3">
                  <CheckCircle className="h-5 w-5" />
                  Migration Complete
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <ResultRow label="Projects imported" value={importResults.projectsImported} />
                  <ResultRow label="Projects skipped" value={importResults.projectsSkipped} />
                  <ResultRow label="Threads imported" value={importResults.threadsImported} />
                  <ResultRow label="Messages imported" value={importResults.messagesImported} />
                  <ResultRow label="Tasks imported" value={importResults.tasksImported} />
                  <ResultRow label="Summaries imported" value={importResults.summariesImported} />
                  <ResultRow label="Workspace files" value={importResults.workspaceFilesRestored} />
                  {importResults.settingsImported > 0 && (
                    <ResultRow label="Settings imported" value={importResults.settingsImported} />
                  )}
                </div>

                {importResults.orphanedThreads > 0 && (
                  <div className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {importResults.orphanedThreads} orphaned thread{importResults.orphanedThreads !== 1 ? 's' : ''} skipped
                  </div>
                )}

                {importResults.errors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs text-red-600 flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {importResults.errors.length} error{importResults.errors.length !== 1 ? 's' : ''}:
                    </div>
                    {importResults.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground ml-4">{err}</p>
                    ))}
                    {importResults.errors.length > 5 && (
                      <p className="text-xs text-muted-foreground ml-4">...and {importResults.errors.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Link href="/">
                  <Button className="gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Go to Projects
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleReset}>
                  Import Another
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy Import Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legacy: Import OpenClaw Sessions</CardTitle>
          <CardDescription>
            Import individual OpenClaw chat sessions as Clawdify projects (the old migration method).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/migration/sessions">
            <Button variant="outline" size="sm" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Import Sessions
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Sub-components ----------
function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
