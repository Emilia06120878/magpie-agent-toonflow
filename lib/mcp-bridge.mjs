// Translate Magpie's library MCP bridge file into Toonflow's mcpServers array.
// Only entries owned by this plugin are ever replaced or removed.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isRecord, MCP_NAME_PREFIX, readJSON, writeJSONIfChanged } from "./constants.mjs";

function isOwned(server) {
  return isRecord(server) && typeof server.name === "string" && server.name.startsWith(MCP_NAME_PREFIX);
}

function transportOf(entry) {
  if (typeof entry.type === "string") return entry.type;
  if (typeof entry.transport === "string") return entry.transport;
  return entry.url ? "http" : "stdio";
}

function translationError(name, reason) {
  return { name, reason };
}

export function translateBridge(bridge, existing = []) {
  const servers = isRecord(bridge) && isRecord(bridge.mcpServers) ? bridge.mcpServers : {};
  const byName = new Map((Array.isArray(existing) ? existing : []).filter(isOwned).map((s) => [s.name, s]));
  const next = [];
  const errors = [];

  for (const [name, value] of Object.entries(servers).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isRecord(value)) {
      errors.push(translationError(name, "not an object"));
      continue;
    }
    const id = byName.get(MCP_NAME_PREFIX + name)?.id || randomUUID();
    const transport = transportOf(value);
    const common = { id, name: MCP_NAME_PREFIX + name, enabled: value.disabled === true ? false : true, transport };
    if (transport === "http" || transport === "sse") {
      if (typeof value.url !== "string" || !/^https?:\/\//.test(value.url)) {
        errors.push(translationError(name, "missing or invalid URL"));
        continue;
      }
      const headers = isRecord(value.headers) ? Object.fromEntries(Object.entries(value.headers)
        .filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v])) : {};
      next.push({ ...common, url: value.url, ...(Object.keys(headers).length ? { headers } : {}) });
    } else if (transport === "stdio") {
      if (typeof value.command !== "string" || !value.command.trim()) {
        errors.push(translationError(name, "missing command"));
        continue;
      }
      const args = Array.isArray(value.args) ? value.args.filter((v) => typeof v === "string") : [];
      const env = isRecord(value.env) ? Object.fromEntries(Object.entries(value.env)
        .filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v])) : {};
      next.push({ ...common, command: value.command, args, ...(Object.keys(env).length ? { env } : {}) });
    } else {
      errors.push(translationError(name, `unsupported transport ${transport}`));
    }
  }
  return { servers: next, errors };
}

export function syncMcpBridge({ bridgeFile, settingsFile, stateFile, env = process.env } = {}) {
  const bridge = readJSON(bridgeFile);
  const settings = readJSON(settingsFile, {});
  if (!isRecord(settings)) return { ok: false, reason: "settings is not an object" };
  const previous = Array.isArray(settings.mcpServers) ? settings.mcpServers : [];
  const userServers = previous.filter((s) => !isOwned(s));
  const { servers, errors } = translateBridge(bridge, previous);
  if (errors.length) return { ok: false, reason: "invalid MCP bridge entries", errors };
  const next = { ...settings, mcpServers: [...userServers, ...servers] };
  const changed = writeJSONIfChanged(settingsFile, next);
  const state = {
    plugin: "magpie-agent-toonflow",
    bridgeMtimeMs: fs.existsSync(bridgeFile) ? fs.statSync(bridgeFile).mtimeMs : 0,
    serverNames: servers.map((s) => s.name),
    errors,
    updatedAt: new Date().toISOString(),
  };
  if (stateFile && (changed || !fs.existsSync(stateFile))) writeJSONIfChanged(stateFile, state);
  return { ok: true, changed, count: servers.length, errors };
}

export function removeOwnedServers(settingsFile) {
  const settings = readJSON(settingsFile, {});
  if (!isRecord(settings) || !Array.isArray(settings.mcpServers)) return false;
  const next = settings.mcpServers.filter((s) => !isOwned(s));
  if (next.length === settings.mcpServers.length) return false;
  return writeJSONIfChanged(settingsFile, { ...settings, mcpServers: next });
}

export function ensureBridgeFile(bridgeFile) {
  if (fs.existsSync(bridgeFile)) return false;
  fs.mkdirSync(path.dirname(bridgeFile), { recursive: true });
  return writeJSONIfChanged(bridgeFile, { mcpServers: {} });
}

export const _internal = { isOwned, transportOf };
