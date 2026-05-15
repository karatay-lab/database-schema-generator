import "server-only";
import { db } from "./client";

type UiStateRow = { value: string };

function get(key: string): string | null {
  const row = db.prepare("SELECT value FROM ui_state WHERE key = ?").get(key) as UiStateRow | undefined;
  return row?.value ?? null;
}

function set(key: string, value: string) {
  db.prepare(`
    INSERT OR REPLACE INTO ui_state (key, value, updated_at) VALUES (?, ?, ?)
  `).run(key, value, new Date().toISOString());
}

export function getUiState(): {
  activeProjectId: string | null;
  activeVersionsMap: Record<string, string>;
} {
  const activeProjectId = get("active_project_id");
  const raw = get("active_versions_map");
  const activeVersionsMap = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  return { activeProjectId, activeVersionsMap };
}

export function setActiveProject(projectId: string) {
  set("active_project_id", projectId);
}

export function setActiveVersionsMap(map: Record<string, string>) {
  set("active_versions_map", JSON.stringify(map));
}

export function setVersionForProject(projectId: string, version: string) {
  const raw = get("active_versions_map");
  const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  map[projectId] = version;
  set("active_versions_map", JSON.stringify(map));
}
