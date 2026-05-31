"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function DropZone({
  accept,
  onFile,
  label,
}: {
  accept: string;
  onFile: (name: string, content: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const content = await file.text();
    onFile(file.name, content);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
        dragging
          ? "border-lime-400 bg-lime-50"
          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
        <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m-4-4l4 4 4-4" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          Drag & drop or click to browse — <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px] font-bold text-slate-600">.pickle.json</code>
        </p>
      </div>
    </div>
  );
}
