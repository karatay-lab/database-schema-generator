"use client";

import { cn } from "@/lib/utils";

export function Card({ children, locked }: { children: React.ReactNode; locked?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white", locked ? "opacity-50 pointer-events-none select-none" : "")}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-slate-200 px-5 py-4">{children}</div>;
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 p-5">{children}</div>;
}
