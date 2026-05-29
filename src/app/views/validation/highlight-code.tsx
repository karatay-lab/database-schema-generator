"use client";

const KEYWORDS = [
  "import", "export", "from", "const", "let", "var", "function", "return",
  "type", "interface", "extends", "as", "if", "else", "for", "while",
  "true", "false", "null", "undefined", "new", "class", "static",
];

const TYPES = [
  "z", "string", "number", "boolean", "date", "bigint", "enum", "any",
  "void", "never", "unknown", "object", "array", "optional", "nullable",
  "min", "max", "length", "email", "url", "uuid", "datetime", "datetime",
  "native", "refine", "transform", "pipe",
];

export function highlightCode(code: string): React.ReactNode {
  const lines = code.split("\n");

  return lines.map((line, lineIndex) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    const tokens: { start: number; end: number; type: string; text: string }[] = [];

    const stringRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
    let match;
    while ((match = stringRegex.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, type: "string", text: match[0] });
    }

    const commentRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/)/g;
    while ((match = commentRegex.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, type: "comment", text: match[0] });
    }

    const wordRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((match = wordRegex.exec(line)) !== null) {
      const word = match[1];
      const isKeyword = KEYWORDS.includes(word);
      const isType = TYPES.includes(word);
      if (isKeyword) {
        tokens.push({ start: match.index, end: match.index + word.length, type: "keyword", text: word });
      } else if (isType) {
        tokens.push({ start: match.index, end: match.index + word.length, type: "type", text: word });
      }
    }

    tokens.sort((a, b) => a.start - b.start);

    for (const token of tokens) {
      if (token.start > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{line.slice(lastIndex, token.start)}</span>);
      }
      const colorClass =
        token.type === "keyword"
          ? "text-purple-600 font-semibold"
          : token.type === "type"
          ? "text-blue-600 font-semibold"
          : token.type === "string"
          ? "text-green-600"
          : token.type === "comment"
          ? "text-slate-400 italic"
          : "";
      parts.push(
        <span key={`token-${token.start}`} className={colorClass}>
          {token.text}
        </span>,
      );
      lastIndex = token.end;
    }

    if (lastIndex < line.length) {
      parts.push(<span key="text-end">{line.slice(lastIndex)}</span>);
    }

    return (
      <div key={lineIndex} className="leading-6">
        <span className="mr-4 inline-select text-slate-400">{String(lineIndex + 1).padStart(3, " ")}</span>
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });
}
