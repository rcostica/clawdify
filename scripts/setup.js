#!/usr/bin/env node

/**
 * Clawdify Interactive Setup Wizard
 *
 * Zero dependencies — uses only Node.js built-in modules.
 * Run: npm run setup  (or: node scripts/setup.js)
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const http = require("http");
const os = require("os");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function print(msg = "") {
  process.stdout.write(msg + "\n");
}

function printBanner() {
  print();
  print(`${BOLD}${CYAN}  🐒 Clawdify Setup Wizard${RESET}`);
  print(`${DIM}  ────────────────────────${RESET}`);
  print(`${DIM}  Mission Control for OpenClaw${RESET}`);
  print();
}

function ask(rl, question, defaultValue) {
  const suffix = defaultValue != null ? ` ${DIM}(${defaultValue})${RESET}` : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || (defaultValue != null ? String(defaultValue) : ""));
    });
  });
}

function checkPort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/health`, { timeout: timeoutMs }, (res) => {
      resolve(true);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function detectGatewayToken() {
  const configPath = path.join(os.homedir(), ".openclaw", "config.yaml");
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*token:\s*['"]?(.+?)['"]?\s*$/);
      if (match) return match[1];
    }
  } catch {
    // file not found or unreadable
  }
  return null;
}

function generateSecret() {
  return crypto.randomBytes(32).toString("hex");
}

function detectWorkspacePath() {
  // Try reading from openclaw config
  const configPath = path.join(os.homedir(), ".openclaw", "config.yaml");
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*workspace:\s*['"]?(.+?)['"]?\s*$/);
      if (match) {
        let ws = match[1].trim();
        ws = ws.replace(/^~/, os.homedir());
        if (fs.existsSync(ws)) return ws;
      }
    }
  } catch {}
  // Fallback: check default location
  const defaultPath = path.join(os.homedir(), ".openclaw", "workspace");
  if (fs.existsSync(defaultPath)) return defaultPath;
  return null;
}

function detectSessionsPath() {
  const defaultPath = path.join(os.homedir(), ".openclaw", "agents", "main", "sessions");
  if (fs.existsSync(defaultPath)) return defaultPath;
  // Try just the agents dir
  const agentsDir = path.join(os.homedir(), ".openclaw", "agents");
  if (fs.existsSync(agentsDir)) {
    // Find the first agent with a sessions dir
    try {
      const agents = fs.readdirSync(agentsDir);
      for (const agent of agents) {
        const sessDir = path.join(agentsDir, agent, "sessions");
        if (fs.existsSync(sessDir)) return sessDir;
      }
    } catch {}
  }
  return null;
}

function enableChatCompletions() {
  const configPath = path.join(os.homedir(), ".openclaw", "config.yaml");
  try {
    if (!fs.existsSync(configPath)) return false;
    let config = fs.readFileSync(configPath, "utf-8");
    
    // Already enabled?
    if (config.match(/chatCompletions[\s\S]*?enabled:\s*true/)) return true;
    
    // Has chatCompletions but disabled?
    if (config.includes("chatCompletions")) {
      config = config.replace(
        /(chatCompletions:[\s\S]*?)enabled:\s*false/,
        "$1enabled: true"
      );
      fs.writeFileSync(configPath, config, "utf-8");
      return true;
    }
    
    // Need to add it
    if (config.includes("gateway:")) {
      if (config.includes("http:")) {
        if (config.includes("endpoints:")) {
          config = config.replace(
            /(endpoints:)/,
            "$1\n      chatCompletions:\n        enabled: true"
          );
        } else {
          config = config.replace(
            /(http:)/,
            "$1\n    endpoints:\n      chatCompletions:\n        enabled: true"
          );
        }
      } else {
        config = config.replace(
          /(gateway:)/,
          "$1\n  http:\n    endpoints:\n      chatCompletions:\n        enabled: true"
        );
      }
    } else {
      config += "\ngateway:\n  http:\n    endpoints:\n      chatCompletions:\n        enabled: true\n";
    }
    
    fs.writeFileSync(configPath, config, "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ─── Help ─────────────────────────────────────────────────────────────────────

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  print();
  print(`${BOLD}Clawdify Setup Wizard${RESET}`);
  print();
  print("Usage: node scripts/setup.js [options]");
  print();
  print("Options:");
  print("  --help, -h    Show this help message");
  print("  --force       Overwrite existing .env file without asking");
  print();
  print("This interactive wizard will:");
  print("  1. Check if the OpenClaw gateway is running");
  print("  2. Auto-detect your gateway token from ~/.openclaw/config.yaml");
  print("  3. Generate a secure session secret");
  print("  4. Ask for optional PIN and port configuration");
  print("  5. Write a .env file");
  print("  6. Optionally create a systemd user service");
  print();
  process.exit(0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const envPath = path.join(projectRoot, ".env");
  const force = process.argv.includes("--force");

  printBanner();

  // Check for existing .env
  if (fs.existsSync(envPath) && !force) {
    print(`  ${YELLOW}⚠${RESET}  A ${BOLD}.env${RESET} file already exists.`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const overwrite = await ask(rl, "Overwrite it? (y/N)", "N");
    if (overwrite.toLowerCase() !== "y") {
      print(`\n  ${DIM}Setup cancelled. Your .env was not changed.${RESET}\n`);
      rl.close();
      process.exit(0);
    }
    rl.close();
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Step 1: Detect everything
  print(`  ${DIM}Detecting OpenClaw installation...${RESET}\n`);
  
  // Gateway
  const gatewayRunning = await checkPort("localhost", 18789);
  if (gatewayRunning) {
    print(`  ${GREEN}✔${RESET}  Gateway running on port 18789`);
  } else {
    print(`  ${YELLOW}⚠${RESET}  Gateway not detected on port 18789`);
    print(`  ${DIM}    Make sure OpenClaw is running before using Clawdify.${RESET}`);
  }

  // Token
  let gatewayToken = detectGatewayToken();
  if (gatewayToken) {
    const masked = gatewayToken.slice(0, 6) + "..." + gatewayToken.slice(-4);
    print(`  ${GREEN}✔${RESET}  Gateway token: ${DIM}${masked}${RESET}`);
  } else {
    print(`  ${YELLOW}!${RESET}  Could not auto-detect gateway token`);
    gatewayToken = await ask(rl, "Enter your OpenClaw gateway token");
    if (!gatewayToken) {
      print(`\n  ${RED}✗${RESET}  Gateway token is required. Aborting.\n`);
      rl.close();
      process.exit(1);
    }
  }

  // Workspace
  let workspacePath = detectWorkspacePath();
  if (workspacePath) {
    print(`  ${GREEN}✔${RESET}  Workspace: ${DIM}${workspacePath}${RESET}`);
  } else {
    print(`  ${YELLOW}!${RESET}  Could not detect workspace path`);
    workspacePath = await ask(rl, "Workspace path", path.join(os.homedir(), ".openclaw", "workspace"));
  }

  // Sessions
  let sessionsPath = detectSessionsPath();
  if (sessionsPath) {
    print(`  ${GREEN}✔${RESET}  Sessions: ${DIM}${sessionsPath}${RESET}`);
  } else {
    print(`  ${DIM}·${RESET}  Sessions path not found (optional — session history won't be available)`);
    sessionsPath = "";
  }

  // Enable chatCompletions
  const chatEnabled = enableChatCompletions();
  if (chatEnabled) {
    print(`  ${GREEN}✔${RESET}  Chat completions endpoint enabled in gateway config`);
    if (gatewayRunning) {
      print(`  ${YELLOW}⚠${RESET}  ${BOLD}Restart the gateway${RESET} after setup: ${CYAN}openclaw gateway restart${RESET}`);
    }
  } else {
    print(`  ${YELLOW}⚠${RESET}  Could not auto-enable chatCompletions — see README for manual config`);
  }

  // Step 2: Ask only what we need
  print();
  const gatewayUrl = await ask(rl, "Gateway URL", "http://localhost:18789");
  const pin = await ask(rl, "Set a PIN for web access (Enter to skip)");
  const port = await ask(rl, "Port", "3000");

  if (pin) {
    print(`  ${GREEN}✔${RESET}  PIN set`);
  } else {
    print(`  ${DIM}  No PIN — Clawdify will be open to anyone who can reach it.${RESET}`);
  }

  // Step 3: Write .env
  const sessionSecret = generateSecret();
  print(`\n  ${GREEN}✔${RESET}  Generated session secret`);

  const envContent = [
    "# Clawdify — generated by setup wizard",
    `# ${new Date().toISOString()}`,
    "",
    "# OpenClaw Gateway",
    `OPENCLAW_GATEWAY_URL=${gatewayUrl}`,
    `OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`,
    `OPENCLAW_WORKSPACE_PATH=${workspacePath}`,
    sessionsPath ? `OPENCLAW_SESSIONS_PATH=${sessionsPath}` : "# OPENCLAW_SESSIONS_PATH=",
    "",
    "# Security",
    `CLAWDIFY_SESSION_SECRET=${sessionSecret}`,
    `CLAWDIFY_PIN=${pin}`,
    "",
    "# Server",
    `PORT=${port}`,
    "",
  ].join("\n");

  fs.writeFileSync(envPath, envContent, "utf-8");
  print(`  ${GREEN}✔${RESET}  Wrote ${BOLD}.env${RESET}`);

  // Step 4: Systemd service
  print();
  const wantSystemd = await ask(rl, "Create a systemd user service? (y/N)", "N");

  if (wantSystemd.toLowerCase() === "y") {
    const serviceDir = path.join(os.homedir(), ".config", "systemd", "user");
    const servicePath = path.join(serviceDir, "clawdify.service");
    const nodePath = process.execPath;
    const npmPath = path.join(path.dirname(nodePath), "npm");

    const serviceContent = [
      "[Unit]",
      "Description=Clawdify — Mission Control for OpenClaw",
      "After=network.target",
      "",
      "[Service]",
      "Type=simple",
      `WorkingDirectory=${projectRoot}`,
      `ExecStart=${npmPath} start`,
      "Restart=always",
      "RestartSec=3",
      "Environment=NODE_ENV=production",
      "",
      "[Install]",
      "WantedBy=default.target",
      "",
    ].join("\n");

    try {
      fs.mkdirSync(serviceDir, { recursive: true });
      fs.writeFileSync(servicePath, serviceContent, "utf-8");
      print(`  ${GREEN}✔${RESET}  Wrote ${DIM}${servicePath}${RESET}`);

      execSync("systemctl --user daemon-reload", { stdio: "ignore" });
      print(`  ${GREEN}✔${RESET}  Reloaded systemd`);

      const enableNow = await ask(rl, "Enable and start the service now? (y/N)", "N");
      if (enableNow.toLowerCase() === "y") {
        print(`  ${DIM}  Enabling and starting clawdify.service...${RESET}`);
        execSync("systemctl --user enable --now clawdify.service", { stdio: "ignore" });
        print(`  ${GREEN}✔${RESET}  Service enabled and started`);
      } else {
        print(`\n  ${DIM}  To start later:${RESET}`);
        print(`  ${DIM}  systemctl --user enable --now clawdify.service${RESET}`);
      }
    } catch (err) {
      print(`  ${RED}✗${RESET}  Failed to create systemd service: ${err.message}`);
      print(`  ${DIM}  You can create it manually — see README.md for details.${RESET}`);
    }
  }

  rl.close();

  // Step 5: Done!
  print();
  print(`  ${GREEN}${BOLD}✔  Setup complete!${RESET}`);
  print();
  if (chatEnabled && gatewayRunning) {
    print(`  ${DIM}Next steps:${RESET}`);
    print(`    1. ${CYAN}openclaw gateway restart${RESET}  ${DIM}(apply chat endpoint config)${RESET}`);
    print(`    2. ${CYAN}npm run build${RESET}`);
    print(`    3. ${CYAN}npm start${RESET}`);
    print(`    4. Open ${CYAN}http://localhost:${port}${RESET}`);
  } else {
    print(`  ${DIM}Next steps:${RESET}`);
    print(`    1. ${CYAN}npm run build${RESET}`);
    print(`    2. ${CYAN}npm start${RESET}`);
    print(`    3. Open ${CYAN}http://localhost:${port}${RESET}`);
  }
  print();
}

main().catch((err) => {
  print(`\n  ${RED}✗${RESET}  Setup failed: ${err.message}\n`);
  process.exit(1);
});
