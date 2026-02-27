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

  // Step 1: Check gateway
  print(`  ${DIM}Checking OpenClaw gateway...${RESET}`);
  const gatewayRunning = await checkPort("localhost", 18789);
  if (gatewayRunning) {
    print(`  ${GREEN}✔${RESET}  Gateway is running on port 18789\n`);
  } else {
    print(`  ${YELLOW}⚠${RESET}  Gateway not detected on port 18789`);
    print(`  ${DIM}  Make sure OpenClaw is running before using Clawdify.${RESET}\n`);
  }

  // Step 2: Detect gateway token
  let gatewayToken = detectGatewayToken();
  if (gatewayToken) {
    const masked = gatewayToken.slice(0, 6) + "..." + gatewayToken.slice(-4);
    print(`  ${GREEN}✔${RESET}  Gateway token auto-detected: ${DIM}${masked}${RESET}`);
    const useDetected = await ask(rl, "Use this token? (Y/n)", "Y");
    if (useDetected.toLowerCase() === "n") {
      gatewayToken = await ask(rl, "Enter gateway token");
    }
  } else {
    print(`  ${YELLOW}⚠${RESET}  Could not auto-detect gateway token from ~/.openclaw/config.yaml`);
    gatewayToken = await ask(rl, "Enter your OpenClaw gateway token");
  }

  if (!gatewayToken) {
    print(`\n  ${RED}✗${RESET}  Gateway token is required. Aborting.\n`);
    rl.close();
    process.exit(1);
  }

  // Step 3: Gateway URL
  print();
  const gatewayUrl = await ask(rl, "Gateway URL", "http://localhost:18789");

  // Step 4: Session secret
  const sessionSecret = generateSecret();
  print(`\n  ${GREEN}✔${RESET}  Generated session secret ${DIM}(64 hex chars)${RESET}`);

  // Step 5: Optional PIN
  print();
  const pin = await ask(rl, "Set a PIN for web access (Enter to skip)");
  if (pin) {
    print(`  ${GREEN}✔${RESET}  PIN set`);
  } else {
    print(`  ${DIM}  No PIN — Clawdify will be open to anyone who can reach it.${RESET}`);
  }

  // Step 6: Port
  print();
  const port = await ask(rl, "Port", "3000");

  // Step 7: Write .env
  print();
  const envContent = [
    "# Clawdify environment — generated by setup wizard",
    `# ${new Date().toISOString()}`,
    "",
    "# OpenClaw Gateway connection",
    `OPENCLAW_GATEWAY_URL=${gatewayUrl}`,
    `OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`,
    "",
    "# Session encryption",
    `CLAWDIFY_SESSION_SECRET=${sessionSecret}`,
    "",
    "# PIN authentication (empty = no auth)",
    `CLAWDIFY_PIN=${pin}`,
    "",
    "# Server port",
    `PORT=${port}`,
    "",
    "# Database location (default: ~/.clawdify/clawdify.db)",
    "# CLAWDIFY_DB_PATH=~/.clawdify/clawdify.db",
    "",
    "# OpenClaw workspace path (for file browser)",
    "# OPENCLAW_WORKSPACE_PATH=~/.openclaw/workspace",
    "",
    "# OpenClaw sessions path (for activity/history)",
    "# OPENCLAW_SESSIONS_PATH=~/.openclaw/agents/main/sessions",
    "",
    "# Session cookie expiry in seconds (default: 7 days)",
    "# CLAWDIFY_SESSION_MAX_AGE=604800",
    "",
  ].join("\n");

  fs.writeFileSync(envPath, envContent, "utf-8");
  print(`  ${GREEN}✔${RESET}  Wrote ${BOLD}.env${RESET}`);

  // Step 8: Enable gateway chatCompletions endpoint
  print();
  print(`  ${DIM}Checking gateway chat endpoint...${RESET}`);
  
  const chatEndpointEnabled = await (async () => {
    if (!gatewayRunning) return false;
    try {
      return await new Promise((resolve) => {
        const postData = JSON.stringify({
          model: "openclaw:main",
          messages: [{ role: "user", content: "ping" }],
        });
        const req = http.request(
          `${gatewayUrl}/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${gatewayToken}`,
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
            timeout: 5000,
          },
          (res) => {
            res.resume();
            // 405 = endpoint disabled, anything else = endpoint is responding
            resolve(res.statusCode !== 405);
          }
        );
        req.on("error", () => resolve(false));
        req.on("timeout", () => { req.destroy(); resolve(false); });
        req.write(postData);
        req.end();
      });
    } catch { return false; }
  })();

  if (chatEndpointEnabled) {
    print(`  ${GREEN}✔${RESET}  Chat completions endpoint is enabled`);
  } else if (gatewayRunning) {
    print(`  ${YELLOW}⚠${RESET}  Chat completions endpoint is ${BOLD}disabled${RESET} on the gateway.`);
    print(`  ${DIM}  Clawdify needs this to send messages. Attempting to enable it...${RESET}`);
    
    // Try to enable it by patching the config
    const configPath = path.join(os.homedir(), ".openclaw", "config.yaml");
    let configFixed = false;
    
    try {
      if (fs.existsSync(configPath)) {
        let config = fs.readFileSync(configPath, "utf-8");
        
        // Check if chatCompletions is already mentioned
        if (config.includes("chatCompletions")) {
          // It's mentioned but probably set to false — replace
          config = config.replace(
            /enabled:\s*false\s*#?\s*chatCompletions/,
            "enabled: true  # chatCompletions"
          );
          fs.writeFileSync(configPath, config, "utf-8");
          configFixed = true;
        } else {
          // Need to add the http.endpoints.chatCompletions section
          // Find or create gateway.http section
          if (config.includes("gateway:")) {
            // Add under gateway section
            if (config.includes("http:")) {
              // http section exists, add endpoints
              config = config.replace(
                /(\s*http:)/,
                "$1\n    endpoints:\n      chatCompletions:\n        enabled: true"
              );
            } else {
              // Add http section under gateway
              config = config.replace(
                /(gateway:)/,
                "$1\n  http:\n    endpoints:\n      chatCompletions:\n        enabled: true"
              );
            }
            fs.writeFileSync(configPath, config, "utf-8");
            configFixed = true;
          }
        }
      }
    } catch (err) {
      // Config patching failed
    }

    if (configFixed) {
      print(`  ${GREEN}✔${RESET}  Updated ${DIM}~/.openclaw/config.yaml${RESET} — chatCompletions enabled`);
      print(`  ${YELLOW}⚠${RESET}  Restart the gateway for this to take effect:`);
      print(`    ${CYAN}openclaw gateway restart${RESET}`);
    } else {
      print(`  ${YELLOW}⚠${RESET}  Could not auto-patch config. Add this to ~/.openclaw/config.yaml manually:`);
      print();
      print(`    ${DIM}gateway:${RESET}`);
      print(`    ${DIM}  http:${RESET}`);
      print(`    ${DIM}    endpoints:${RESET}`);
      print(`    ${DIM}      chatCompletions:${RESET}`);
      print(`    ${DIM}        enabled: true${RESET}`);
      print();
      print(`    Then restart: ${CYAN}openclaw gateway restart${RESET}`);
    }
  }

  // Step 9: Systemd service
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

  // Step 10: Done!
  print();
  print(`  ${GREEN}${BOLD}✔  Setup complete!${RESET}`);
  print();
  print(`  ${DIM}Next steps:${RESET}`);
  print(`    1. Build:    ${CYAN}npm run build${RESET}`);
  print(`    2. Start:    ${CYAN}npm start${RESET}`);
  print(`    3. Open:     ${CYAN}http://localhost:${port}${RESET}`);
  print();
  print(`  ${DIM}For development:  ${CYAN}npm run dev${RESET}`);
  print();
}

main().catch((err) => {
  print(`\n  ${RED}✗${RESET}  Setup failed: ${err.message}\n`);
  process.exit(1);
});
