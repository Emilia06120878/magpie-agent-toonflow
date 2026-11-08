import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { translateBridge, syncMcpBridge } from "../lib/mcp-bridge.mjs";

test("translates claude-format HTTP and stdio entries into Toonflow array", () => {
  const result = translateBridge({ mcpServers: {
    web: { type: "http", url: "http://127.0.0.1:3425/mcp/magpie/web-search", headers: { Authorization: "Bearer k" } },
    tools: { type: "stdio", command: "node", args: ["tool.js"], env: { A: "B" } },
  } });
  assert.equal(result.errors.length, 0);
  assert.equal(result.servers.length, 2);
  assert.equal(result.servers[0].name, "magpie-toonflow:tools");
  assert.equal(result.servers[0].transport, "stdio");
  assert.equal(result.servers[1].name, "magpie-toonflow:web");
  assert.equal(result.servers[1].url, "http://127.0.0.1:3425/mcp/magpie/web-search");
});

test("sync preserves user MCP servers and removes only owned stale entries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "toonflow-mcp-"));
  const bridgeFile = path.join(dir, "bridge.json");
  const settingsFile = path.join(dir, "settings.json");
  fs.writeFileSync(bridgeFile, JSON.stringify({ mcpServers: { one: { type: "http", url: "https://example.test/mcp" } } }));
  fs.writeFileSync(settingsFile, JSON.stringify({
    mcpServers: [
      { id: "user", name: "mine", transport: "http", enabled: true, url: "https://mine.test" },
      { id: "old", name: "magpie-toonflow:old", transport: "http", enabled: true, url: "https://old.test" },
    ],
  }));
  const result = syncMcpBridge({ bridgeFile, settingsFile });
  assert.equal(result.ok, true);
  const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assert.equal(settings.mcpServers.length, 2);
  assert.equal(settings.mcpServers[0].name, "mine");
  assert.equal(settings.mcpServers[1].name, "magpie-toonflow:one");
  fs.rmSync(dir, { recursive: true, force: true });
});
