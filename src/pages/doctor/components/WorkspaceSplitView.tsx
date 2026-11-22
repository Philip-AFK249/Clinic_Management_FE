import type { ReactNode } from "react";

interface WorkspaceSplitViewProps {
  /** Live transcript, left column. */
  left: ReactNode;
  /** The full editor (SOAP + ICD-10 + tree + prescription), right column. */
  right: ReactNode;
}

/**
 * The consultation workspace: a fixed 2/3 split between the live transcript
 * and the editable record. The doctor portal is a desktop station, so the
 * split is always on instead of switching to a phone tab bar.
 */
export default function WorkspaceSplitView({
  left,
  right,
}: WorkspaceSplitViewProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-5">
      <section className="col-span-2 flex min-h-0 min-w-0 flex-col border-r border-slate-200/80 bg-white">
        {left}
      </section>
      <section className="col-span-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-light">
        {right}
      </section>
    </div>
  );
}
