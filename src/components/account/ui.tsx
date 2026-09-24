import type { ReactNode } from "react";

/** Form and table primitives shared by the account, apply and admin screens. */

export const inputCls = "w-full border border-[var(--line-soft)] px-3 py-2";
export const cellCls = "border border-[var(--line-soft)] px-3 py-2 align-top";
export const headCls = "ui bg-[var(--paper-soft)] text-left";

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label className="ui block text-sm font-semibold" htmlFor={htmlFor}>
        {label}
      </label>
      {hint && <p className="ui m-0 text-xs text-[var(--ink-soft)]">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok" | "info"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-[var(--line-soft)] bg-[var(--paper-soft)] text-[var(--ink-soft)]";
  return <p className={`ui mt-4 border px-3 py-2 text-sm ${cls}`}>{children}</p>;
}

const PILL: Record<string, string> = {
  applied: "bg-amber-50 text-amber-800 border-amber-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  resolved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
  revoked: "bg-rose-50 text-rose-800 border-rose-200",
  suspended: "bg-rose-50 text-rose-800 border-rose-200",
  dismissed: "bg-gray-100 text-gray-700 border-gray-300",
  conflict: "bg-orange-50 text-orange-800 border-orange-200",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`ui inline-block rounded border px-2 py-0.5 text-xs font-semibold capitalize ${PILL[status] ?? PILL.dismissed}`}>
      {status}
    </span>
  );
}

/** Approve / reject-with-reason pair, posting `decision` (+ `reason`) to `action`. */
export function DecisionForms({ action, approveLabel = "Approve", rejectLabel = "Reject" }: { action: string; approveLabel?: string; rejectLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <form method="POST" action={action}>
        <input type="hidden" name="decision" value="approved" />
        <button type="submit" className="ui border border-[var(--line-soft)] bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
          {approveLabel}
        </button>
      </form>
      <form method="POST" action={action} className="flex items-center gap-1">
        <input type="hidden" name="decision" value="rejected" />
        <input type="text" name="reason" required placeholder="Reason" aria-label="Reason" className="ui w-28 border border-[var(--line-soft)] px-1.5 py-1 text-xs" />
        <button type="submit" className="ui border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100">
          {rejectLabel}
        </button>
      </form>
    </div>
  );
}
