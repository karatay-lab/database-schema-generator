"use client";

type RestrictionTypeGuideProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export function RestrictionTypeGuide({ isOpen, onToggle }: RestrictionTypeGuideProps) {
  return (
    <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
          When &amp; why to add a restriction
        </span>
        <span className="text-xs font-semibold text-violet-400">{isOpen ? "Hide" : "Show"}</span>
      </button>
      {isOpen && (
        <div className="grid gap-4 border-t border-violet-100 px-4 py-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-700">Unique constraint</p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              Prevents two rows from sharing the same value(s) in the selected columns. The database rejects any insert or update that would create a duplicate.
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Add when</p>
            <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-slate-600">
              <li>• A column must be a business identifier — email, username, slug, phone number.</li>
              <li>• A <span className="font-semibold">combination</span> of columns must be unique — e.g. <code className="rounded bg-slate-100 px-1 text-[11px]">(userId, projectId)</code> in a membership table.</li>
              <li>• You want the database to enforce uniqueness without relying on application code.</li>
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              A unique constraint also creates an implicit index, so no separate Index is needed on the same column(s).
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-violet-700">Index</p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              Builds an internal lookup structure so the database can find rows quickly without scanning the whole table. Does not enforce uniqueness.
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Add when</p>
            <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-slate-600">
              <li>• A column appears in <code className="rounded bg-slate-100 px-1 text-[11px]">WHERE</code>, <code className="rounded bg-slate-100 px-1 text-[11px]">JOIN ON</code>, or <code className="rounded bg-slate-100 px-1 text-[11px]">ORDER BY</code> in frequent queries.</li>
              <li>• A foreign key column — without an index, cascade deletes and joins are slow.</li>
              <li>• A column used for dashboard filters, search, or pagination at scale.</li>
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Trade-off: indexes consume extra storage and slightly slow down writes. Add them where query speed matters, not by default on every column.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
