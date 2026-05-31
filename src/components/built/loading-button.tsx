"use client";

import { cn } from "@/lib/utils";

/**
 * A thin wrapper over <button> that adds a `isLoading` prop.
 * When loading, the button is disabled and shows an animated ellipsis spinner.
 * All other <button> attributes (className, onClick, type, disabled, …) pass through.
 *
 * Styling is intentionally not opinionated — pass className to set colors and size,
 * exactly as you would with a raw <button>.
 *
 * Example:
 *   <LoadingButton
 *     isLoading={saveState === "loading"}
 *     onClick={handleSave}
 *     className="h-9 rounded-md bg-cyan-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
 *   >
 *     Save
 *   </LoadingButton>
 */
export function LoadingButton({
  isLoading,
  children,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={isLoading ?? disabled}
      className={cn(
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
          <span>{typeof children === "string" ? children : "Loading…"}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
