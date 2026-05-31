"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { typeBadgeClass } from "@/constants/schema";
import type { FieldTemplate } from "@/lib/field-template-store";

export function TemplateDropdown({
  baseTemplates,
  addingTemplateId,
  onAddNewField,
  onAddTemplate,
  onOpenFullTemplates,
}: {
  baseTemplates: FieldTemplate[];
  addingTemplateId: string;
  onAddNewField: () => void;
  onAddTemplate: (template: FieldTemplate) => void;
  onOpenFullTemplates: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const filtered = search
    ? baseTemplates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : baseTemplates;

  return (
    <div className="relative flex" ref={ref}>
      <button
        type="button"
        onClick={onAddNewField}
        className="flex h-9 items-center gap-1.5 rounded-l-md border border-r-0 border-cyan-300 bg-white px-3 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50"
      >
        <IconPlus size={14} stroke={2} />
        New Field
      </button>
      <button
        type="button"
        onClick={() => { setIsOpen((o) => !o); setSearch(""); }}
        className="flex h-9 items-center rounded-r-md border border-cyan-300 bg-white px-2 text-cyan-600 transition hover:bg-cyan-50"
        title="Add from template"
      >
        <IconChevronDown size={14} stroke={2} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              autoFocus
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs font-medium text-slate-500">
                {baseTemplates.length === 0 ? "No templates yet." : "No matches."}
              </div>
            ) : (
              filtered.map((template) => {
                const isBusy = addingTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setSearch("");
                      onAddTemplate(template);
                    }}
                    disabled={isBusy}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    <span className="min-w-0 truncate text-xs font-semibold text-slate-950">
                      {template.name}
                    </span>
                    <span className={classNames("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", typeBadgeClass(template.type))}>
                      {template.type}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => { setIsOpen(false); onOpenFullTemplates(); }}
              className="text-xs font-semibold text-emerald-600 transition hover:underline"
            >
              Open full Templates →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
