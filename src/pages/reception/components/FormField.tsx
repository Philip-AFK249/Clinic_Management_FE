import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}

/**
 * Label + control + validation message. The message is always rendered (as a
 * non-breaking space when empty) so the layout never jumps on first keystroke.
 */
export default function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  trailing,
  children,
}: FormFieldProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {trailing}
      </div>
      {children}
      <p
        role={error ? "alert" : undefined}
        className="mt-1 min-h-[14px] text-[11px] leading-[14px]"
      >
        {error ? (
          <span className="flex items-center gap-1 font-medium text-red-600">
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {error}
          </span>
        ) : hint ? (
          <span className="text-slate-400">{hint}</span>
        ) : (
          <span>&nbsp;</span>
        )}
      </p>
    </div>
  );
}
