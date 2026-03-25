import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { readFile, access, readdir } from 'fs/promises';
import { constants } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';

function run(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      resolve(err ? '' : stdout.trim());
    });
  });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

export async function GET() {
  const home = homedir();
  const openclawDir = join(home, '.openclaw');
  const configPath = join(openclawDir, 'openclaw.json');

  // Run independent operations in parallel
  const [
    dfOutput,
    meminfoRaw,
    loadavgRaw,
    uptimeRaw,
    versionOutput,
    gatewayHealth,
    configExists,
    sessionFiles,
    configRaw,
  ] = await Promise.all([
    // Disk usage
    run('df -h /'),
    // RAM
    readFile('/proc/meminfo', 'utf-8').catch(() => ''),
    // CPU load
    readFile('/proc/loadavg', 'utf-8').catch(() => ''),
    // Uptime
    readFile('/proc/uptime', 'utf-8').catch(() => ''),
    // OpenClaw version
    run('openclaw --version'),
    // Gateway health
    fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(5000) })
      .then(r => ({ connected: r.ok || r.status === 401, status: r.status }))
      .catch(() => ({ connected: false, status: 0 })),
    // Config exists
    access(configPath, constants.F_OK).then(() => true).catch(() => false),
    // Session count
    readdir(join(openclawDir, 'agents', 'main', 'sessions')).catch(() => [] as string[]),
    // Config contents
    readFile(configPath, 'utf-8').catch(() => ''),
  ]);

  // Parse disk usage
  let disk = { used: '?', available: '?', total: '?', percent: 0 };
  try {
    const lines = dfOutput.split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      disk = {
        total: parts[1] || '?',
        used: parts[2] || '?',
        available: parts[3] || '?',
        percent: parseInt(parts[4] || '0', 10),
      };
    }
  } catch { /* ignore */ }

  // Parse RAM
  let ram = { total: '?', available: '?', used: '?', percent: 0 };
  try {
    const memTotal = parseInt(meminfoRaw.match(/MemTotal:\s+(\d+)/)?.[1] || '0', 10);
    const memAvail = parseInt(meminfoRaw.match(/MemAvailable:\s+(\d+)/)?.[1] || '0', 10);
    const totalGB = (memTotal / 1048576).toFixed(1);
    const availGB = (memAvail / 1048576).toFixed(1);
    const usedGB = ((memTotal - memAvail) / 1048576).toFixed(1);
    const pct = memTotal > 0 ? Math.round(((memTotal - memAvail) / memTotal) * 100) : 0;
    ram = { total: `${totalGB}G`, available: `${availGB}G`, used: `${usedGB}G`, percent: pct };
  } catch { /* ignore */ }

  // Parse CPU load
  let cpu = { load1: '?', load5: '?', load15: '?' };
  try {
    const parts = loadavgRaw.split(/\s+/);
    cpu = { load1: parts[0], load5: parts[1], load15: parts[2] };
  } catch { /* ignore */ }

  // Parse uptime
  let uptime = '?';
  try {
    const secs = parseFloat(uptimeRaw.split(/\s+/)[0]);
    uptime = formatUptime(secs);
  } catch { /* ignore */ }

  // Session count
  const sessionCount = sessionFiles.filter(f => f.endsWith('.jsonl')).length;

  // Parse config for channels and model info
  let channels: string[] = [];
  let modelName = '?';
  let modelFallbacks: string[] = [];

  if (configRaw) {
    try {
      // Try JSON.parse first
      let config: any;
      try {
        config = JSON.parse(configRaw);
      } catch {
        // JSON5 fallback — extract with regex
        config = null;
      }

      if (config) {
        // Extract channels from plugins.entries
        const entries = config?.plugins?.entries;
        if (entries && typeof entries === 'object') {
          for (const [key, val] of Object.entries(entries)) {
            if (typeof val === 'object' && val !== null && 'enabled' in (val as any)) {
              if ((val as any).enabled !== false) {
                channels.push(key);
              }
            } else {
              channels.push(key);
            }
          }
        }

        // Extract model info
        const model = config?.agents?.defaults?.model;
        if (model) {
          if (typeof model === 'string') {
            modelName = model;
          } else if (model.primary) {
            modelName = model.primary;
          } else if (model.name) {
            modelName = model.name;
          }
          if (Array.isArray(model.fallbacks)) {
            modelFallbacks = model.fallbacks.map((f: any) =>
              typeof f === 'string' ? f : f.name || String(f)
            );
          }
        }
      } else {
        // Regex fallback for JSON5
        const modelMatch = configRaw.match(/['"]?name['"]?\s*:\s*['"]([^'"]+)['"]/);
        if (modelMatch) modelName = modelMatch[1];

        const channelMatches = configRaw.match(/['"]?(telegram|discord|whatsapp|signal|webchat|slack|matrix|irc|device-pair)['"]?\s*:/g);
        if (channelMatches) {
          channels = channelMatches.map(m => m.replace(/['":\s]/g, ''));
        }
      }
    } catch { /* ignore */ }
  }

  // Filter to known channel types
  const knownChannels = ['telegram', 'discord', 'whatsapp', 'signal', 'webchat', 'slack', 'matrix', 'irc', 'device-pair'];
  channels = channels.filter(c => knownChannels.includes(c));

  return NextResponse.json({
    gateway: {
      connected: gatewayHealth.connected,
      version: versionOutput || '?',
    },
    system: {
      cpu,
      uptime,
    },
    resources: {
      disk,
      ram,
    },
    openclaw: {
      configExists,
      sessionCount,
    },
    model: {
      name: modelName,
      fallbacks: modelFallbacks,
    },
    channels,
  });
}
