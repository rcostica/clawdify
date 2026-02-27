'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2, RefreshCw, Plus, Trash2, Save, Eye, EyeOff, Download, Upload, AlertTriangle, Smartphone, Share, FolderSearch, FolderPlus, FileText, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePWA } from '@/components/pwa-register';
import { useInstanceName } from '@/components/instance-name';

interface DiscoveredFolder {
  name: string;
  relativePath: string;
  fileCount: number;
  hasReadme: boolean;
  readmePreview: string | null;
  hasContextMd: boolean;
  alreadyLinked: boolean;
  linkedProjectName: string | null;
  children: DiscoveredFolder[];
}

interface AuditLog {
  id: string;
  action: string;
  details?: string;
  createdAt: Date;
}

interface VaultEntry {
  id: string;
  key: string;
  value?: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function SettingsPage() {
  const [gatewayStatus, setGatewayStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [gatewayInfo, setGatewayInfo] = useState<string>('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Global system prompt
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');

  // Backup & Restore
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  // PWA Install
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWA();

  // Instance name
  const { instanceName: currentInstanceName, setInstanceName: setGlobalInstanceName } = useInstanceName();
  const [instanceName, setInstanceName] = useState('');
  const [instanceNameLoading, setInstanceNameLoading] = useState(false);
  const [instanceNameMsg, setInstanceNameMsg] = useState('');

  // Workspace Discovery
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveredFolders, setDiscoveredFolders] = useState<DiscoveredFolder[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  // parentMap: childPath → parentPath (for nesting before import)
  const [parentMap, setParentMap] = useState<Map<string, string>>(new Map());
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // Vault
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [vaultMessage, setVaultMessage] = useState('');
  const [showValues, setShowValues] = useState(false);

  // Check gateway status
  useEffect(() => {
    async function checkGateway() {
      try {
        const res = await fetch('/api/gateway/status');
        if (res.ok) {
          const data = await res.json();
          setGatewayStatus('connected');
          setGatewayInfo(data.version || 'Connected');
        } else {
          setGatewayStatus('error');
          setGatewayInfo('Gateway returned error');
        }
      } catch {
        setGatewayStatus('error');
        setGatewayInfo('Cannot connect to gateway');
      }
    }
    checkGateway();
  }, []);

  // Load global system prompt
  useEffect(() => {
    async function loadPrompt() {
      try {
        const res = await fetch('/api/settings?key=global_system_prompt');
        const data = await res.json();
        setGlobalPrompt(data.value || '');
      } catch { /* ignore */ }
      setPromptLoading(false);
    }
    loadPrompt();
  }, []);

  const saveGlobalPrompt = async () => {
    setPromptSaving(true);
    setPromptMessage('');
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'global_system_prompt', value: globalPrompt }),
      });
      setPromptMessage('✅ Saved');
      setTimeout(() => setPromptMessage(''), 2000);
    } catch {
      setPromptMessage('❌ Failed to save');
    }
    setPromptSaving(false);
  };

  // Load instance name
  useEffect(() => {
    setInstanceName(currentInstanceName);
  }, [currentInstanceName]);

  const saveInstanceName = async () => {
    setInstanceNameLoading(true);
    setInstanceNameMsg('');
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'instance_name', value: instanceName.trim() || 'Clawdify' }),
      });
      setGlobalInstanceName(instanceName.trim() || 'Clawdify');
      setInstanceNameMsg('✅ Saved — reinstall PWA to update the app name');
      setTimeout(() => setInstanceNameMsg(''), 5000);
    } catch {
      setInstanceNameMsg('❌ Failed to save');
    }
    setInstanceNameLoading(false);
  };

  // Load vault entries
  const fetchVault = useCallback(async () => {
    setVaultLoading(true);
    try {
      const res = await fetch(`/api/vault?includeValues=${showValues}`);
      const data = await res.json();
      setVaultEntries(data.entries || []);
    } catch { /* ignore */ }
    setVaultLoading(false);
  }, [showValues]);

  useEffect(() => { fetchVault(); }, [fetchVault]);

  const addVaultEntry = async () => {
    if (!newKey || !newValue) return;
    setVaultMessage('');
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      if (!res.ok) {
        const data = await res.json();
        setVaultMessage(`❌ ${data.error}`);
        return;
      }
      setNewKey('');
      setNewValue('');
      fetchVault();
    } catch {
      setVaultMessage('❌ Failed to add');
    }
  };

  const deleteVaultEntry = async (id: string) => {
    await fetch(`/api/vault?id=${id}`, { method: 'DELETE' });
    fetchVault();
  };

  // Change PIN
  const handleChangePin = async () => {
    setPinLoading(true);
    setPinMessage('');
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setPinMessage('✅ PIN updated successfully');
        setCurrentPin('');
        setNewPin('');
      } else {
        setPinMessage(`❌ ${data.error}`);
      }
    } catch {
      setPinMessage('❌ Failed to change PIN');
    } finally {
      setPinLoading(false);
    }
  };

  // Audit logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (auditOpen && auditLogs.length === 0) fetchAuditLogs();
  }, [auditOpen]);

  // Backup download
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Backup failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'clawdify-backup.tar.gz';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch {
      toast.error('Failed to create backup');
    } finally {
      setBackupLoading(false);
    }
  };

  // Restore from backup
  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoreLoading(true);
    try {
      const formData = new FormData();
      formData.append('backup', restoreFile);
      const res = await fetch('/api/backup/restore?confirm=true', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Restore failed');
        return;
      }
      toast.success(data.message || 'Backup restored successfully');
      setRestoreFile(null);
      setRestoreDialogOpen(false);
    } catch {
      toast.error('Failed to restore backup');
    } finally {
      setRestoreLoading(false);
    }
  };

  // Discover workspace
  const scanWorkspace = async () => {
    setDiscoveryLoading(true);
    setDiscoveredFolders([]);
    setSelectedFolders(new Set());
    setDiscoveryDone(false);
    try {
      const res = await fetch('/api/discover');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Scan failed');
        return;
      }
      setDiscoveredFolders(data.discovered || []);
      setDiscoveryDone(true);
      // Auto-select unlinked folders
      const unlinked = new Set<string>();
      const collect = (folders: DiscoveredFolder[]) => {
        for (const f of folders) {
          if (!f.alreadyLinked) unlinked.add(f.relativePath);
          collect(f.children);
        }
      };
      collect(data.discovered || []);
      setSelectedFolders(unlinked);
    } catch {
      toast.error('Failed to scan workspace');
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const toggleFolder = (path: string) => {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const importDiscovered = async () => {
    if (selectedFolders.size === 0) return;
    setImportLoading(true);
    try {
      // Build folder list with parent relationships
      // Import parents first, then children
      const allPaths = Array.from(selectedFolders);
      const childPaths = new Set(parentMap.keys());
      const parentPaths = allPaths.filter(p => !childPaths.has(p));
      const childPathsArr = allPaths.filter(p => childPaths.has(p));
      
      // Import parents first
      if (parentPaths.length > 0) {
        const res = await fetch('/api/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folders: parentPaths.map(p => ({ relativePath: p })) }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || 'Import failed');
          setImportLoading(false);
          return;
        }
      }

      // Import children with parentPath reference
      if (childPathsArr.length > 0) {
        const res = await fetch('/api/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folders: childPathsArr.map(p => ({
              relativePath: p,
              parentWorkspacePath: parentMap.get(p),
            })),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || 'Import failed');
          setImportLoading(false);
          return;
        }
      }

      const total = allPaths.length;
      toast.success(`Created ${total} project${total > 1 ? 's' : ''}`);
      setParentMap(new Map());
      // Re-scan to update state
      await scanWorkspace();
    } catch {
      toast.error('Failed to create projects');
    } finally {
      setImportLoading(false);
    }
  };

  // Get children assigned to a parent via drag-and-drop
  const getAssignedChildren = (parentPath: string): DiscoveredFolder[] => {
    const childPaths: string[] = [];
    parentMap.forEach((parent, child) => {
      if (parent === parentPath) childPaths.push(child);
    });
    const allFolders = flattenFolders(discoveredFolders);
    return childPaths.map(cp => allFolders.find(f => f.relativePath === cp)).filter(Boolean) as DiscoveredFolder[];
  };

  const flattenFolders = (folders: DiscoveredFolder[]): DiscoveredFolder[] => {
    const result: DiscoveredFolder[] = [];
    const walk = (list: DiscoveredFolder[]) => {
      for (const f of list) {
        result.push(f);
        walk(f.children);
      }
    };
    walk(folders);
    return result;
  };

  const removeFromParent = (childPath: string) => {
    setParentMap(prev => {
      const next = new Map(prev);
      next.delete(childPath);
      return next;
    });
  };

  const renderDiscoveredFolder = (folder: DiscoveredFolder, depth: number = 0, isNested: boolean = false) => {
    const isSelected = selectedFolders.has(folder.relativePath);
    const isChild = parentMap.has(folder.relativePath);
    const isDragOver = dragOverPath === folder.relativePath;
    const assignedChildren = getAssignedChildren(folder.relativePath);

    // Don't render at top level if it's been dragged into a parent
    if (isChild && !isNested) return null;

    return (
      <div key={folder.relativePath}>
        <div
          draggable={!folder.alreadyLinked}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', folder.relativePath);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!folder.alreadyLinked) setDragOverPath(folder.relativePath);
          }}
          onDragLeave={() => setDragOverPath(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverPath(null);
            const childPath = e.dataTransfer.getData('text/plain');
            if (childPath && childPath !== folder.relativePath && !folder.alreadyLinked) {
              setParentMap(prev => {
                const next = new Map(prev);
                next.set(childPath, folder.relativePath);
                return next;
              });
            }
          }}
          className={`flex items-start gap-3 py-2 px-3 rounded-md transition-colors cursor-grab active:cursor-grabbing ${
            folder.alreadyLinked ? 'opacity-60' : 'hover:bg-muted/50'
          } ${depth > 0 ? 'ml-6' : ''} ${isNested ? 'ml-8 border-l-2 border-primary/30' : ''} ${
            isDragOver ? 'ring-2 ring-primary bg-primary/10' : ''
          }`}
        >
          {!folder.alreadyLinked ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleFolder(folder.relativePath)}
              className="mt-1 h-4 w-4 rounded border-input accent-primary"
            />
          ) : (
            <Link2 className="mt-1 h-4 w-4 text-green-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{folder.name}</span>
              <span className="text-xs text-muted-foreground">
                {folder.fileCount} file{folder.fileCount !== 1 ? 's' : ''}
              </span>
              {folder.hasReadme && (
                <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">README</span>
              )}
              {folder.hasContextMd && (
                <span className="text-xs bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded">CONTEXT</span>
              )}
              {isNested && (
                <button
                  onClick={() => removeFromParent(folder.relativePath)}
                  className="text-xs text-red-400 hover:text-red-300 ml-1"
                  title="Remove from parent"
                >
                  ✕ ungroup
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">{folder.relativePath}</span>
            {folder.alreadyLinked && (
              <span className="text-xs text-green-500 block">→ Linked to &quot;{folder.linkedProjectName}&quot;</span>
            )}
            {folder.readmePreview && !folder.alreadyLinked && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{folder.readmePreview}</p>
            )}
          </div>
        </div>
        {/* Show filesystem children */}
        {folder.children.map(child => renderDiscoveredFolder(child, depth + 1))}
        {/* Show drag-assigned children */}
        {assignedChildren.map(child => renderDiscoveredFolder(child, 0, true))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Gateway Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Gateway Connection
            {gatewayStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            {gatewayStatus === 'connected' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {gatewayStatus === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
          </CardTitle>
          <CardDescription>
            {gatewayStatus === 'connected' ? gatewayInfo : gatewayStatus === 'error' ? gatewayInfo : 'Checking...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Gateway URL</label>
            <Input value="http://localhost:18789" disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Gateway Token</label>
            <Input type="password" value="••••••••" disabled className="bg-muted" />
          </div>
        </CardContent>
      </Card>

      {/* Install App */}
      {!isInstalled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install App
            </CardTitle>
            <CardDescription>
              Install Clawdify as a standalone app for a native experience — no browser chrome, faster loading, home screen icon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canInstall ? (
              <Button
                onClick={async () => {
                  const accepted = await promptInstall();
                  if (accepted) {
                    toast.success('Clawdify installed!');
                  }
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Install Clawdify
              </Button>
            ) : isIOS ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Share className="h-4 w-4 flex-shrink-0" />
                  Tap the <strong>Share</strong> button in Safari, then select <strong>&quot;Add to Home Screen&quot;</strong>.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your browser will offer the install option after a couple of visits. You can also look for the install icon in your browser&apos;s address bar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workspace & Instance */}
      <Card>
        <CardHeader>
          <CardTitle>Instance</CardTitle>
          <CardDescription>Name this Clawdify instance to distinguish it from others. The name appears in the browser tab and PWA app name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Instance Name</label>
            <div className="flex gap-2">
              <Input
                value={instanceName}
                onChange={e => setInstanceName(e.target.value)}
                placeholder="Clawdify"
                className="flex-1"
              />
              <Button onClick={saveInstanceName} disabled={instanceNameLoading} size="sm" className="gap-1">
                {instanceNameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
            {instanceNameMsg && <p className="text-sm">{instanceNameMsg}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace Path</label>
            <Input value={process.env.OPENCLAW_WORKSPACE_PATH || '~/.openclaw/workspace'} disabled className="bg-muted font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Discover Projects from Workspace */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderSearch className="h-5 w-5" />
            Discover Projects
          </CardTitle>
          <CardDescription>
            Scan your OpenClaw workspace for existing folders and create Clawdify projects from them. Drag a folder onto another to make it a sub-project. Already-linked folders are shown but can&apos;t be re-imported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={scanWorkspace} disabled={discoveryLoading} className="gap-2">
            {discoveryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSearch className="h-4 w-4" />}
            Scan Workspace
          </Button>

          {discoveryDone && discoveredFolders.length === 0 && (
            <p className="text-sm text-muted-foreground">No folders found in workspace.</p>
          )}

          {discoveredFolders.length > 0 && (
            <>
              <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                {discoveredFolders.map(folder => renderDiscoveredFolder(folder))}
              </div>

              {selectedFolders.size > 0 && (
                <Button onClick={importDiscovered} disabled={importLoading} className="gap-2">
                  {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                  Create {selectedFolders.size} Project{selectedFolders.size > 1 ? 's' : ''}
                </Button>
              )}

              {selectedFolders.size === 0 && discoveryDone && (
                <p className="text-sm text-muted-foreground">All folders are already linked to projects.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Backup & Export */}
      <Card>
        <CardHeader>
          <CardTitle>Backup & Export</CardTitle>
          <CardDescription>Download a full backup or restore from a previous one. Includes database and workspace files. Remote access is handled via Tailscale.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownloadBackup} disabled={backupLoading} className="gap-2">
              {backupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Full Backup
            </Button>
            <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
              <Button variant="outline" className="gap-2" onClick={() => setRestoreDialogOpen(true)}>
                <Upload className="h-4 w-4" />
                Restore from Backup
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Restore from Backup
                  </DialogTitle>
                  <DialogDescription>
                    This will <strong>overwrite</strong> your current database and workspace files. A safety copy of the current database will be saved before restoring. This cannot be easily undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept=".tar.gz,.tgz"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  />
                  {restoreFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {restoreFile.name} ({(restoreFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setRestoreDialogOpen(false); setRestoreFile(null); }}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRestore}
                    disabled={!restoreFile || restoreLoading}
                    className="gap-2"
                  >
                    {restoreLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    Restore
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-xs text-muted-foreground">
            Backups include the full SQLite database and all workspace files packaged as a .tar.gz archive.
          </p>
        </CardContent>
      </Card>

      {/* Global System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Global System Prompt</CardTitle>
          <CardDescription>Prepended to all project chats. Use for security rules and global instructions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {promptLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                value={globalPrompt}
                onChange={e => setGlobalPrompt(e.target.value)}
                placeholder="Enter global system prompt..."
              />
              <div className="flex items-center gap-2">
                <Button onClick={saveGlobalPrompt} disabled={promptSaving} className="gap-2">
                  {promptSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
                {promptMessage && <span className="text-sm">{promptMessage}</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Credential Vault */}
      <Card>
        <CardHeader>
          <CardTitle>Credential Vault</CardTitle>
          <CardDescription>Shared credentials available to all projects. Key names are shared with AI; values are kept secret.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowValues(!showValues)} className="gap-1">
              {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showValues ? 'Hide' : 'Show'} Values
            </Button>
          </div>

          {vaultLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : vaultEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credentials stored yet.</p>
          ) : (
            <div className="space-y-2">
              {vaultEntries.map(entry => (
                <div key={entry.id} className="flex items-center gap-2 py-1">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">{entry.key}</code>
                  {showValues && entry.value && (
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate">{entry.value}</code>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteVaultEntry(entry.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <Input
              placeholder="KEY_NAME"
              value={newKey}
              onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              className="font-mono flex-1"
            />
            <Input
              type="password"
              placeholder="value"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              className="font-mono flex-1"
            />
            <Button onClick={addVaultEntry} disabled={!newKey || !newValue} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {vaultMessage && <p className="text-sm">{vaultMessage}</p>}
        </CardContent>
      </Card>

      {/* Security - PIN Change */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Change your authentication PIN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current PIN</label>
            <Input
              type="password"
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value)}
              placeholder="Current PIN (leave empty if none set)"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New PIN</label>
            <Input
              type="password"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="New PIN (min 4 characters)"
            />
          </div>
          <Button onClick={handleChangePin} disabled={pinLoading || !newPin}>
            {pinLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Change PIN
          </Button>
          {pinMessage && <p className="text-sm">{pinMessage}</p>}
        </CardContent>
      </Card>

      {/* Migration */}
      <Card>
        <CardHeader>
          <CardTitle>Migration</CardTitle>
          <CardDescription>Transfer your entire Clawdify workspace between machines — export everything as a .zip, import on a new machine with project discovery, conflict handling, and workspace file restoration.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/migration">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Open Migration Wizard
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center gap-2">
                Audit Log
                {auditOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
              <CardDescription>Recent activity log (last 50 entries)</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {auditLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No audit logs yet</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[140px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      <span className="font-medium">{log.action}</span>
                      {log.details && (
                        <span className="text-muted-foreground text-xs truncate">{log.details}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="mt-2" onClick={fetchAuditLogs}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
