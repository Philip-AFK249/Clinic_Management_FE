/**
 * Shared control styling for the reception intake form. Kept out of the
 * component folder's `.tsx` files so fast refresh stays valid.
 */
export const CONTROL_CLASS =
  "h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export function controlClass(hasError: boolean, extra = ""): string {
  return [
    CONTROL_CLASS,
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
      : "border-slate-300 focus:border-teal-600 focus:ring-teal-100",
    extra,
  ].join(" ");
}
