import "server-only";
import path from "node:path";
import { db } from "./client";

export type FsFileType =
  | "zod_file"
  | "connection_file"
  | "snapshot_dir"
  | "migration_log";

type FsPathRow = { fs_path: string; label: string | null; version: string | null };

export function registerFsPath(opts: {
  projectId: string | null;
  connectionId?: string | null;
  version?: string | null;
  fileType: FsFileType;
  label?: string | null;
  fsPath: string;
}) {
  const rel = path.relative(/*turbopackIgnore: true*/ process.cwd(), opts.fsPath);
  db.prepare(`
    INSERT OR REPLACE INTO fs_paths
      (project_id, connection_id, version, file_type, label, fs_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.projectId,
    opts.connectionId ?? null,
    opts.version ?? null,
    opts.fileType,
    opts.label ?? null,
    rel,
    new Date().toISOString(),
  );
}

export function lookupFsPath(opts: {
  projectId: string;
  version?: string;
  connectionId?: string;
  fileType: FsFileType;
  label?: string;
}): string | null {
  const conditions = ["project_id = ?", "file_type = ?"];
  const params: unknown[] = [opts.projectId, opts.fileType];
  if (opts.version !== undefined)      { conditions.push("version = ?");       params.push(opts.version); }
  if (opts.connectionId !== undefined) { conditions.push("connection_id = ?"); params.push(opts.connectionId); }
  if (opts.label !== undefined)        { conditions.push("label = ?");         params.push(opts.label); }

  const row = db.prepare(`SELECT fs_path FROM fs_paths WHERE ${conditions.join(" AND ")}`).get(params) as { fs_path: string } | undefined;
  return row ? path.join(/*turbopackIgnore: true*/ process.cwd(), row.fs_path) : null;
}

export function listFsPaths(opts: {
  projectId?: string;
  connectionId?: string;
  fileType?: FsFileType;
}): { fsPath: string; label: string | null; version: string | null }[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts.projectId)    { conditions.push("project_id = ?");    params.push(opts.projectId); }
  if (opts.connectionId) { conditions.push("connection_id = ?"); params.push(opts.connectionId); }
  if (opts.fileType)     { conditions.push("file_type = ?");     params.push(opts.fileType); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT fs_path, label, version FROM fs_paths ${where} ORDER BY created_at DESC`).all(params) as FsPathRow[];
  return rows.map((r) => ({ fsPath: path.join(/*turbopackIgnore: true*/ process.cwd(), r.fs_path), label: r.label, version: r.version }));
}

export function updateFsPathPrefix(projectId: string, oldAbsPrefix: string, newAbsPrefix: string) {
  const oldRel = path.relative(/*turbopackIgnore: true*/ process.cwd(), oldAbsPrefix);
  const newRel = path.relative(/*turbopackIgnore: true*/ process.cwd(), newAbsPrefix);
  db.prepare(`
    UPDATE fs_paths
    SET fs_path = ? || substr(fs_path, ? + 1)
    WHERE project_id = ? AND fs_path LIKE ?
  `).run(newRel, oldRel.length, projectId, `${oldRel}%`);
}
