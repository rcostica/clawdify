'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2, Sun, Moon, RefreshCw, Plus, Trash2, Save, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Global system prompt
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');

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

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem('clawdify-theme') || 'light';
    setTheme(saved as 'light' | 'dark');
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('clawdify-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
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

      {/* Workspace */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace Path</label>
            <Input value="/home/razvan/.openclaw/workspace" disabled className="bg-muted font-mono text-xs" />
          </div>
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

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={toggleTheme} className="gap-2">
            {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'light' ? 'Light' : 'Dark'} Mode
          </Button>
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
          <CardTitle>Data Migration</CardTitle>
          <CardDescription>Import existing OpenClaw sessions</CardDescription>
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
