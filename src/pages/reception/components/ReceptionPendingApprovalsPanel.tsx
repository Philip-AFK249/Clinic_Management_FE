import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import PendingApprovalsBoard from "../../admin/components/PendingApprovalsBoard";

interface ReceptionPendingApprovalsPanelProps {
  /** Refresh the desk's own queue after a decision moves a ticket. */
  onChanged: () => void;
}

/**
 * Collapsible approval board for the Reception desk.
 *
 * Receptionists already monitor the live queue on the right half of the screen;
 * pending transfers live in the same column above it so a decision is one click
 * away without leaving the check-in workflow.
 */
export default function ReceptionPendingApprovalsPanel({
  onChanged,
}: ReceptionPendingApprovalsPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <section
      className={`flex min-h-0 flex-col border-b border-slate-200/80 bg-white ${
        open ? "h-[46%]" : "h-auto"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex shrink-0 items-center justify-between gap-2 px-4 py-2 text-left transition-colors hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
          Pending Approvals · Xác nhận chuyển khoản
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="min-h-0 flex-1 px-3 pb-3">
          <PendingApprovalsBoard compact onChanged={onChanged} />
        </div>
      )}
    </section>
  );
}
