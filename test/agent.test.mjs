import assert from "node:assert/strict";
import test from "node:test";
import { agent, connect } from "../toonflow.agent.mjs";

test("agent descriptor uses stable paths, official icon, and MCP bridge", () => {
  assert.equal(agent.id, "toonflow");
  assert.match(agent.icon, /^data:image\/svg\+xml;base64,/);
  assert.equal(agent.config, "~/.config/magpie/toonflow-data/settings.json");
  assert.equal(agent.library.mcpFormat, "claude");
  assert.equal(agent.model, undefined); // connect-only, model picked in Toonflow
});

test("connect writes text models only, never a Toonflow media provider", () => {
  const out = connect({
    gateway: { url: "http://127.0.0.1:3425", v1: "http://127.0.0.1:3425/v1", key: "sk-test" },
    models: [
      { id: "workbuddy/hy4free", name: "Hy4", context: 100000, output: 8192 },
      { id: "workbuddy/hy4free", name: "duplicate" },
      { id: "zcode/glm", name: "GLM" },
    ],
  });
  assert.deepEqual(Object.keys(out), ["settings.customProviders"]);
  assert.equal(out["settings.customProviders"].length, 1);
  assert.equal(out["settings.customProviders"][0].apiUrl, "http://127.0.0.1:3425/v1");
  assert.equal(out["settings.customProviders"][0].protocol, "openai-completions");
  assert.equal(out["settings.customProviders"][0].models.length, 2);
  assert.equal(out["settings.customProviders"][0].models[0].contextWindow, 100000);
});

test("connect refuses an empty model catalog", () => {
  assert.throws(() => connect({ gateway: { v1: "http://127.0.0.1:3425/v1", key: "k" }, models: [] }), /no models/);
});
