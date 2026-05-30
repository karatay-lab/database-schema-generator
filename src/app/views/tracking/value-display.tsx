"use client";

export function ValueDisplay({ text }: { text: string }) {
  if (text === "—") return <span className="text-slate-400">—</span>;
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
      {text}
    </code>
  );
}
