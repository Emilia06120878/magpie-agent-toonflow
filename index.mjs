// Magpie plugin-host entry. This module performs only installation-time
// side effects in Magpie/Toonflow config directories; it opens no listeners.

import fs from "node:fs";
import { mcpBridgePath, readJSON, stableSettingsPath, statePath, writeJSONIfChanged } from "./lib/constants.mjs";
import { ensureStableDataRoot } from "./lib/discovery.mjs";
import { ensureBridgeFile, syncMcpBridge } from "./lib/mcp-bridge.mjs";

let bridgeWatcher;

function syncBridge(env = process.env) {
  return syncMcpBridge({
    bridgeFile: mcpBridgePath(env),
    settingsFile: stableSettingsPath(env),
    stateFile: statePath(env),
  });
}

function watchBridge(env) {
  if (bridgeWatcher) return;
  const bridgeFile = mcpBridgePath(env);
  try {
    let pending;
    bridgeWatcher = fs.watch(bridgeFile, () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        try {
          syncBridge(env);
        } catch (error) {
          console.error("[magpie-agent-toonflow] MCP bridge:", error.message);
        }
      }, 100);
      pending.unref?.();
    });
    bridgeWatcher.on("error", (error) => console.error("[magpie-agent-toonflow] MCP bridge watch:", error.message));
    bridgeWatcher.unref?.();
  } catch (error) {
    console.error("[magpie-agent-toonflow] MCP bridge watch:", error.message);
  }
}

function installation(env) {
  const discovery = ensureStableDataRoot(env);
  const bridgeFile = mcpBridgePath(env);
  const bridge = { created: ensureBridgeFile(bridgeFile) };
  const mcp = syncBridge(env);
  watchBridge(env);
  return { discovery, bridge, mcp };
}

export async function runPlugin(input, options, env = process.env) {
  const result = installation(env);
  const file = statePath(env);
  writeJSONIfChanged(file, {
    ...(readJSON(file, {}) || {}),
    lastLoad: result,
    lastLoadAt: new Date().toISOString(),
  });
  return {};
}

export default {
  id: "toonflow-agent",
  server: runPlugin,
};
