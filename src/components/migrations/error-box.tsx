"use client";

// ErrorBox is the monospace-CLI variant of InlineError.
// Kept here for backward compatibility with existing imports.
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
      <p className="whitespace-pre-wrap font-mono text-xs text-rose-700">{message}</p>
    </div>
  );
}
