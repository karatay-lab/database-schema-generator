"use client";

export function MigrationLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600">{children}</label>;
}

export function MigrationInput({
  value, onChange, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500"
    />
  );
}
