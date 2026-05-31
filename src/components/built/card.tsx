"use client";

import { cn } from "@/lib/utils";

export function Card({
  children,
  locked,
  className,
}: {
  children: React.ReactNode;
  locked?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white",
        locked && "pointer-events-none select-none opacity-50",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-slate-200 px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 p-5", className)}>
      {children}
    </div>
  );
}
