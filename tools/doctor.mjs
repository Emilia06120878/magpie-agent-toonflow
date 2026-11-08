// Read-only local diagnostics for magpie-agent-Toonflow.

import fs from "node:fs";
import { discoverToonflow } from "../lib/discovery.mjs";
import { mcpBridgePath, readJSON, stableDataRoot, stableSettingsPath, statePath } from "../lib/constants.mjs";

const discovery = discoverToonflow();
const bridge = mcpBridgePath();
const result = {
  discovery: discovery ? { dataDir: discovery.dataDir, source: discovery.source, version: discovery.version } : null,
  stableRoot: stableDataRoot(),
  stableRootExists: fs.existsSync(stableDataRoot()),
  settingsExists: fs.existsSync(stableSettingsPath()),
  mcpBridgeExists: fs.existsSync(bridge),
  mcpBridgeEntries: Object.keys(readJSON(bridge, {})?.mcpServers || {}).length,
  state: readJSON(statePath(), null),
};
console.log(JSON.stringify(result, null, 2));
