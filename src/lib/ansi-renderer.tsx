"use client";

import { cn } from "@/lib/utils";

type AnsiState = { bold: boolean; color: string; underline: boolean };

function ansiClassName(state: AnsiState) {
  return cn(
    state.bold ? "font-bold" : "",
    state.underline ? "underline underline-offset-2" : "",
    state.color,
  );
}

function applyAnsiCode(state: AnsiState, code: number): AnsiState {
  if (code === 0) return { bold: false, color: "", underline: false };
  if (code === 1) return { ...state, bold: true };
  if (code === 22) return { ...state, bold: false };
  if (code === 4) return { ...state, underline: true };
  if (code === 24) return { ...state, underline: false };
  if (code === 39) return { ...state, color: "" };
  const colorMap: Record<number, string> = {
    30: "text-slate-950", 31: "text-red-400", 32: "text-emerald-400",
    33: "text-amber-300", 34: "text-blue-400", 35: "text-fuchsia-400",
    36: "text-cyan-300", 37: "text-slate-100", 90: "text-slate-500",
    91: "text-red-300", 92: "text-emerald-300", 93: "text-amber-200",
    94: "text-blue-300", 95: "text-fuchsia-300", 96: "text-cyan-200",
    97: "text-white",
  };
  return colorMap[code] ? { ...state, color: colorMap[code] } : state;
}

export function renderAnsiOutput(output: string): React.ReactNode[] {
  const text = output || "No output.";
  const chunks = text.split(/(\x1b\[[0-9;]*m)/g);
  let state: AnsiState = { bold: false, color: "", underline: false };
  let index = 0;
  return chunks.flatMap((chunk) => {
    const match = chunk.match(/^\x1b\[([0-9;]*)m$/);
    if (match) {
      const codes = match[1] ? match[1].split(";").map((c) => Number(c || 0)) : [0];
      for (const code of codes) state = applyAnsiCode(state, code);
      return [];
    }
    if (!chunk) return [];
    index += 1;
    return [<span key={index} className={ansiClassName(state)}>{chunk}</span>];
  });
}
