// Shared constants and settings helpers for the Toonflow Magpie plugin.
//
// This module deliberately uses Node-compatible ESM so it can be unit-tested
// with `node --test` and loaded by Magpie's Bun plugin host.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const PLUGIN_ID = "toonflow";
export const PROVIDER_ID = "magpie";
export const PROVIDER_LABEL = "Magpie";
export const MCP_BRIDGE_NAME = "Toonflow MCP Bridge";
export const MCP_NAME_PREFIX = "magpie-toonflow:";
export const SETTINGS_FILE = "settings.json";
export const MCP_BRIDGE_FILE = "toonflow-mcp-bridge.json";
export const LOCK_FILE = ".magpie-toonflow-installed.json";
export const STATE_FILE = ".magpie-toonflow-state.json";

export function homeDir(env = process.env) {
  return env.HOME || env.USERPROFILE || os.homedir();
}

export function configRoot(env = process.env) {
  return path.join(homeDir(env), ".config", "magpie");
}

export function stableDataRoot(env = process.env) {
  return path.join(configRoot(env), "toonflow-data");
}

export function stableSettingsPath(env = process.env) {
  return path.join(stableDataRoot(env), SETTINGS_FILE);
}

export function mcpBridgePath(env = process.env) {
  return path.join(configRoot(env), MCP_BRIDGE_FILE);
}

export function installLockPath(env = process.env) {
  return path.join(stableDataRoot(env), LOCK_FILE);
}

export function statePath(env = process.env) {
  return path.join(configRoot(env), STATE_FILE);
}

export function readJSON(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJSON(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
}

export function writeJSONIfChanged(file, value) {
  const before = readJSON(file);
  if (JSON.stringify(before) === JSON.stringify(value)) return false;
  writeJSON(file, value);
  return true;
}

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
