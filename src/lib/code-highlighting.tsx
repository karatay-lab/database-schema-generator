"use client";

import type { ReactNode } from "react";
import { TS_KEYWORDS, TS_TYPES, PRISMA_KEYWORDS, PRISMA_TYPES } from "@/constants/exports";

export function highlightCode(code: string, lang: "ts" | "prisma"): ReactNode {
  const keywords = lang === "prisma" ? PRISMA_KEYWORDS : TS_KEYWORDS;
  const types = lang === "prisma" ? PRISMA_TYPES : TS_TYPES;

  return code.split("\n").map((line, lineIndex) => {
    const parts: ReactNode[] = [];
    const tokens: { start: number; end: number; kind: string; text: string }[] = [];

    let match: RegExpExecArray | null;

    const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
    while ((match = stringRe.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, kind: "string", text: match[0] });
    }

    const commentRe = /(\/\/.*$)/g;
    while ((match = commentRe.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, kind: "comment", text: match[0] });
    }

    if (lang === "prisma") {
      const attrRe = /(@{1,2}[a-zA-Z_][a-zA-Z0-9_]*)/g;
      while ((match = attrRe.exec(line)) !== null) {
        tokens.push({ start: match.index, end: match.index + match[0].length, kind: "attribute", text: match[0] });
      }
    }

    const wordRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((match = wordRe.exec(line)) !== null) {
      const word = match[1];
      if (keywords.has(word)) {
        tokens.push({ start: match.index, end: match.index + word.length, kind: "keyword", text: word });
      } else if (types.has(word)) {
        tokens.push({ start: match.index, end: match.index + word.length, kind: "type", text: word });
      }
    }

    tokens.sort((a, b) => a.start - b.start);
    const dedupedTokens: typeof tokens = [];
    let cursor = 0;
    for (const token of tokens) {
      if (token.start >= cursor) {
        dedupedTokens.push(token);
        cursor = token.end;
      }
    }

    let lastIndex = 0;
    for (const token of dedupedTokens) {
      if (token.start > lastIndex) {
        parts.push(<span key={`t-${lastIndex}`}>{line.slice(lastIndex, token.start)}</span>);
      }
      const cls =
        token.kind === "keyword" ? "text-purple-600 font-semibold"
        : token.kind === "type" ? "text-blue-600 font-semibold"
        : token.kind === "string" ? "text-green-600"
        : token.kind === "attribute" ? "text-rose-500 font-semibold"
        : token.kind === "comment" ? "text-slate-400 italic"
        : "";
      parts.push(<span key={`t-${token.start}`} className={cls}>{token.text}</span>);
      lastIndex = token.end;
    }

    if (lastIndex < line.length) {
      parts.push(<span key="t-end">{line.slice(lastIndex)}</span>);
    }

    return (
      <div key={lineIndex} className="leading-6">
        <span className="mr-4 select-none text-slate-400">
          {String(lineIndex + 1).padStart(3, " ")}
        </span>
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });
}
