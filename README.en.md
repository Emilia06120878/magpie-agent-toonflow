# magpie-agent-Toonflow

[简体中文](README.md) | English

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/Emilia06120878/magpie-agent-Toonflow)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A [Magpie](https://github.com/yetone/magpie) agent plugin that detects a local [Toonflow](https://github.com/HBAI-Ltd/Toonflow-app) installation, makes it manageable from Magpie's Agents page, shares Magpie's text models with Toonflow, and syncs Magpie Library MCP resources to Toonflow. The Agent row and plugin icon use Toonflow's official logo (MIT; see [assets/TOONFLOW-LICENSE](assets/TOONFLOW-LICENSE)).

## Feature matrix

| Capability | Imported by this plugin? | How it works |
| --- | --- | --- |
| Magpie **text models** | ✅ | After connecting Toonflow, all available text models are written into Toonflow's `magpie` custom provider. Pick a model inside Toonflow. |
| Magpie **image/video models** as Toonflow media models | ❌ | The plugin does not create `providers/*.ts` media providers, does not write `mediaProviderConfigs`, and does not add entries to Toonflow's media model list. |
| Magpie **image/video generation** | ✅ (through MCP) | Assign `magpie-image` to Toonflow in the Magpie Library. Toonflow calls Magpie's configured image/video models through the `generate_image`, `generate_video`, and `generation_result` MCP tools. |
| Magpie Library **MCP servers** | ✅ | Assign a server to Toonflow in the Library. The plugin translates the selection into Toonflow's `mcpServers` array. |
| Launching/stopping Toonflow | ❌ | The plugin neither starts nor stops Toonflow and does not install a PATH shim. Open Toonflow yourself. |

> **About image models:** `magpie-image` uses Magpie's Image generation settings and MCP tool arguments. It is **not** a native Toonflow media provider. Toonflow's media nodes do not automatically enumerate every Magpie image model. Model availability, defaults, permissions, and quotas remain managed by Magpie.

## Requirements

- A Magpie version with Agent plugins, `agent.library.mcp`, and Library MCP server assignment.
- A local Toonflow desktop installation. The plugin targets Toonflow 2.x configuration and has been tested with 2.0.10.
- Magpie and Toonflow running on the same Windows computer.
- Text models are served through Magpie's local OpenAI-compatible `/v1` gateway.
- Image/video generation through `magpie-image` requires Magpie to have suitable models configured.

## Installation

The repository uses the GitHub topic `magpie-plugin` so it appears in Magpie's community plugin discovery list. Install it directly with the Magpie CLI:

```bash
magpie plugin add github:Emilia06120878/magpie-agent-Toonflow
```

Or clone the repository and install its directory:

```bash
git clone https://github.com/Emilia06120878/magpie-agent-Toonflow.git
magpie plugin add ./magpie-agent-Toonflow
```

After installation:

1. Confirm the plugin is enabled on Magpie's **Plugins** page. If you changed the source, toggle the plugin off and on to reload the plugin host.
2. Open Toonflow.
3. Find the Toonflow row on Magpie's **Agents** page and enable its connection switch.
4. Pick one of the Magpie-provided models in Toonflow's text model selector.
5. In the Magpie Library, assign the MCP servers you need to Toonflow, including `magpie-image`.

To remove the plugin:

```bash
magpie plugin rm github:Emilia06120878/magpie-agent-Toonflow
```

When the Agent is disconnected, Magpie restores the text provider configuration it wrote. MCP bridge entries can be removed by unassigning them in the Library. The plugin never changes MCP servers that you added manually in Toonflow.

## How it works

### Text models

`toonflow.agent.mjs` uses Magpie's official connect-only Agent plugin contract. When connected, Magpie writes the currently available text models into:

```text
settings.customProviders
```

inside Toonflow's `settings.json`, as one `magpie` provider using a per-agent gateway key and Magpie's `/v1` address. Model selection stays inside Toonflow, so switching models does not require returning to Magpie. Magpie's stash/restore mechanism restores the previous values when disconnected.

While connected, Toonflow's `customProviders` array contains only the Magpie provider. Previously configured custom text providers return when the Agent is disconnected.

### MCP resources

Toonflow stores MCP clients as an array, while Magpie's `agent.library.mcpFormat` writes an object-shaped Claude-style file. The plugin bridges the two formats:

```text
Magpie Library assignment
  → ~/.config/magpie/toonflow-mcp-bridge.json (Claude format)
  → plugin main module watches the file
  → mcpServers[] in Toonflow settings.json (array format)
```

Entries synchronized into Toonflow carry the `magpie-toonflow:` name prefix. The plugin replaces or removes only entries with this prefix; MCP servers added manually by the user are left untouched.

### Dynamic discovery

On Windows, Toonflow's data directory lives inside its installation directory, whose location can vary. The plugin tries, in order:

1. The `TOONFLOW_DATA_DIR` environment variable.
2. The launcher path from the desktop shortcut.
3. Running Toonflow processes.
4. Windows uninstall registry entries.

After finding the data directory, it creates a directory junction at `~/.config/magpie/toonflow-data` so Magpie's static Agent configuration path remains stable. The junction provides access; it does not copy data. If the path already exists and points elsewhere, the plugin refuses to overwrite it.

### `magpie-image` generation path

```text
Magpie Library → assign magpie-image to Toonflow
  → Toonflow MCP client
  → generate_image / generate_video / generation_result
  → Magpie Image generation settings and configured models
```

This path does not require or create a Toonflow media provider. The plugin does not show placeholder entries such as "default image model" in Toonflow's media model page.

## Safety and boundaries

- The plugin uses only the per-agent gateway key issued by Magpie. It does not read, copy, or display upstream provider credentials.
- It does not start/stop Toonflow, enable Toonflow's MCP server switch, or write a launcher into the system PATH.
- It opens no persistent HTTP listener. The MCP bridge uses local file watching.
- Text model and MCP synchronization write only to Magpie/Toonflow configuration directories. Media model configuration is never written.
- The Windows directory junction is created only inside Magpie's configuration directory and never overwrites a conflicting path.

## Project structure

```text
package.json                 Plugin manifest, GitHub metadata, Agent entry, and official icon
README.md                    Chinese documentation
README.en.md                 English documentation
index.mjs                    Bun plugin host entry: discovery, bridge file, MCP watcher
toonflow.agent.mjs           moejs Agent descriptor and connect(): text models only
lib/discovery.mjs            Windows installation/data discovery and stable junction
lib/mcp-bridge.mjs           Claude-format → Toonflow mcpServers[] translation
lib/constants.mjs            Paths and atomic JSON helpers
assets/                      Official Toonflow logo and license
test/                        Unit tests
tools/doctor.mjs             Read-only local diagnostics
```

## Development and verification

```bash
npm test
node tools/doctor.mjs
```

`doctor` only reads local paths and reports the Toonflow discovery result, stable directory, bridge file, and state file; it does not modify configuration. Unit tests cover text model writing, MCP translation and ownership, and discovery conflict protection.

## Known limitations

- Dynamic discovery currently supports Windows. Other platforms need a stable `TOONFLOW_DATA_DIR` or extended discovery logic.
- While connected, the Magpie text provider owns `customProviders`.
- Toonflow's media model page does not list Magpie image models. Use the `magpie-image` MCP server from the Library.
- MCP bridge entries depend on Magpie Library assignments. The plugin does not import arbitrary external MCP configurations back into Magpie.
- A real GUI image/video generation task also depends on Magpie's Image generation settings, model permissions, and quota.

## License

The code is [MIT](LICENSE). The official Toonflow icon comes from `HBAI-Ltd/Toonflow-app`; see [assets/TOONFLOW-LICENSE](assets/TOONFLOW-LICENSE).
