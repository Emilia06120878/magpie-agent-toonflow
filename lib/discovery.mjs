// Discover Toonflow's Windows installation and expose its data directory to
// Magpie's agent descriptor at a stable, home-relative path.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { stableDataRoot, isRecord, readJSON, writeJSON, installLockPath } from "./constants.mjs";

const SAFE_WINDOWS_PATH = /^[A-Za-z]:[\\/][^"<>|\r\n]+$/;
const JPEG_SAFE = /^[A-Za-z]:[\\/]/;

function normalizeWindowsPath(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/^"|"$/g, "");
  return SAFE_WINDOWS_PATH.test(trimmed) ? trimmed : "";
}

function desktopDirs(env = process.env) {
  const home = env.USERPROFILE || env.HOME;
  const dirs = [];
  if (home) dirs.push(path.join(home, "Desktop"));
  if (env.PUBLIC) dirs.push(path.join(env.PUBLIC, "Desktop"));
  return dirs.filter((d) => fs.existsSync(d));
}

function shortcutCandidates(env = process.env) {
  return desktopDirs(env).flatMap((dir) => [
    path.join(dir, "Toonflow.lnk"),
    path.join(dir, "ToonFlow.lnk"),
    path.join(dir, "toonflow.lnk"),
  ]).filter((f) => fs.existsSync(f));
}

function shortcutTarget(file) {
  if (process.platform !== "win32") return "";
  const script = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${JSON.stringify(file)}); $s.TargetPath`;
  try {
    return normalizeWindowsPath(execFileSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command", script,
    ], { encoding: "utf8", windowsHide: true, timeout: 5000 }).trim());
  } catch {
    return "";
  }
}

function fromLauncher(launcher) {
  const normalized = normalizeWindowsPath(launcher);
  if (!normalized || !fs.existsSync(normalized)) return null;
  // D:\Toonflow\app\Resources\app\startupLauncher.exe -> D:\Toonflow
  let dir = path.win32.dirname(normalized);
  for (let i = 0; i < 8; i += 1) {
    const data = path.win32.join(dir, "data");
    const version = path.win32.join(dir, "app", "Resources", "version.json");
    if (fs.existsSync(data) && fs.existsSync(version)) {
      return { dataDir: data, launcher, source: "shortcut", version: readJSON(version)?.version || "" };
    }
    const parent = path.win32.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function fromProcesses(env = process.env) {
  if (process.platform !== "win32") return null;
  const script = "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -match 'Toonflow' } | Select-Object -First 5 -ExpandProperty ExecutablePath";
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", windowsHide: true, timeout: 8000 });
    for (const line of out.split(/\r?\n/)) {
      const found = fromLauncher(line);
      if (found) return { ...found, source: "process" };
    }
  } catch {
    // A locked-down machine may deny CIM queries; shortcut discovery still works.
  }
  return null;
}

function fromRegistry() {
  if (process.platform !== "win32") return null;
  const script = "$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Get-ItemProperty $p -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Toonflow' } | Select-Object -ExpandProperty InstallLocation";
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", windowsHide: true, timeout: 8000 });
    for (const line of out.split(/\r?\n/)) {
      const dir = normalizeWindowsPath(line);
      const data = dir && path.win32.join(dir, "data");
      if (data && fs.existsSync(data)) {
        const versionFile = path.win32.join(dir, "app", "Resources", "version.json");
        return { dataDir: data, launcher: "", source: "registry", version: readJSON(versionFile)?.version || "" };
      }
    }
  } catch {
    // Optional source.
  }
  return null;
}

function fromEnv(env = process.env) {
  const dir = normalizeWindowsPath(env.TOONFLOW_DATA_DIR || "");
  if (!dir || !fs.existsSync(dir)) return null;
  return { dataDir: dir, launcher: "", source: "TOONFLOW_DATA_DIR", version: "" };
}

export function discoverCandidates(env = process.env) {
  const found = [];
  const envCandidate = fromEnv(env);
  if (envCandidate) found.push(envCandidate);
  for (const shortcut of shortcutCandidates(env)) {
    const candidate = fromLauncher(shortcutTarget(shortcut));
    if (candidate) found.push(candidate);
  }
  const processCandidate = fromProcesses(env);
  if (processCandidate) found.push(processCandidate);
  const registryCandidate = fromRegistry();
  if (registryCandidate) found.push(registryCandidate);
  return found.filter((c, i, all) => all.findIndex((x) => x.dataDir.toLowerCase() === c.dataDir.toLowerCase()) === i);
}

export function discoverToonflow(env = process.env) {
  for (const candidate of discoverCandidates(env)) {
    if (fs.existsSync(path.join(candidate.dataDir, "settings.json"))) return candidate;
  }
  return discoverCandidates(env)[0] || null;
}

function linkDataDir(dataDir, root) {
  if (!JPEG_SAFE.test(dataDir)) throw new Error(`Toonflow data path is not supported: ${dataDir}`);
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const stat = fs.lstatSync(root, { throwIfNoEntry: false });
  if (!stat) {
    if (process.platform !== "win32") return { linked: false, reason: "non-windows" };
    execFileSync("cmd.exe", ["/d", "/s", "/c", "mklink", "/J", root, dataDir],
      { windowsHide: true, timeout: 8000 });
    return { linked: true };
  }
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    try {
      if (fs.realpathSync(root).toLowerCase() === fs.realpathSync(dataDir).toLowerCase()) return { linked: true };
    } catch {
      // A broken junction is reported below rather than overwritten.
    }
  }
  throw new Error(`Stable Toonflow data path already exists and points elsewhere: ${root}`);
}

export function ensureStableDataRoot(env = process.env, root = stableDataRoot(env)) {
  const discovery = discoverToonflow(env);
  if (!discovery) return { ok: false, reason: "Toonflow installation not found", root };
  try {
    const link = linkDataDir(discovery.dataDir, root);
    if (!link.linked) return { ok: false, reason: link.reason, root, discovery };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error), root, discovery };
  }
  const settings = path.join(root, "settings.json");
  const lock = {
    plugin: "magpie-agent-toonflow",
    version: 1,
    source: discovery.source,
    dataDir: discovery.dataDir,
    versionFound: discovery.version,
    linkedAt: new Date().toISOString(),
  };
  const lockFile = installLockPath(env);
  if (JSON.stringify(readJSON(lockFile)) !== JSON.stringify(lock)) writeJSON(lockFile, lock);
  return { ok: true, root, settings, discovery, lock };
}

export function detectInstalled(env = process.env) {
  if (!isRecord(readJSON(installLockPath(env)))) return false;
  return fs.existsSync(path.join(stableDataRoot(env), "settings.json"));
}
