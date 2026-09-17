import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getContributorRequests, type RequestStatus } from "@/lib/users";

export const metadata: Metadata = { title: "Contributor Requests — Temple Directory" };

const STATUS_STYLE: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  denied: { label: "Denied", cls: "bg-rose-50 text-rose-800 border-rose-200" },
};
const STATUS_ORDER: RequestStatus[] = ["pending", "approved", "denied"];

export default async function ContributorRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/contributor-requests");
  if (session.role !== "admin") redirect("/status");

  const { error } = await searchParams;
  const requests = getContributorRequests();
  const byStatus = (s: RequestStatus) => requests.filter((r) => r.status === s);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="text-2xl">Contributor Requests</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Approve a request to let that username log in as a contributor. Denying requires a reason,
        which is shown to them if they try to log in again.
      </p>

      {error && (
        <p className="ui mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="ui mt-6 text-sm text-[var(--ink-soft)]">No requests yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="ui bg-[var(--paper-soft)] text-left">
                <th className="border border-[var(--line-soft)] px-3 py-2">Username</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Name</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Phone</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Email</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Reason given</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Requested</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Status</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Admin actions</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_ORDER.flatMap((s) => byStatus(s)).map((r) => {
                const style = STATUS_STYLE[r.status];
                return (
                  <tr key={r.username}>
                    <td className="border border-[var(--line-soft)] px-3 py-2 font-semibold">
                      {r.username}
                    </td>
                    <td className="border border-[var(--line-soft)] px-3 py-2">{r.name}</td>
                    <td className="border border-[var(--line-soft)] px-3 py-2 whitespace-nowrap">{r.phone}</td>
                    <td className="border border-[var(--line-soft)] px-3 py-2 whitespace-nowrap">{r.email}</td>
                    <td className="border border-[var(--line-soft)] px-3 py-2 max-w-[240px]">
                      {r.reason ?? <span className="ui text-[var(--ink-soft)]">—</span>}
                    </td>
                    <td className="border border-[var(--line-soft)] px-3 py-2 whitespace-nowrap">
                      {new Date(r.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="border border-[var(--line-soft)] px-3 py-2">
                      <span className={`ui inline-block rounded border px-2 py-0.5 text-xs font-semibold ${style.cls}`}>
                        {style.label}
                      </span>
                      {r.status === "denied" && r.denyReason && (
                        <div className="ui mt-1 text-xs text-[var(--ink-soft)]">Reason: {r.denyReason}</div>
                      )}
                    </td>
                    <td className="border border-[var(--line-soft)] px-3 py-2">
                      {r.status === "pending" ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <form method="POST" action={`/api/users/${r.username}/status`}>
                            <input type="hidden" name="decision" value="approved" />
                            <button
                              type="submit"
                              className="ui border border-[var(--line-soft)] bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              Approve
                            </button>
                          </form>
                          <form
                            method="POST"
                            action={`/api/users/${r.username}/status`}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="decision" value="denied" />
                            <input
                              type="text"
                              name="denyReason"
                              required
                              placeholder="Reason"
                              className="ui w-24 border border-[var(--line-soft)] px-1.5 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="ui border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                            >
                              Deny
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="ui text-xs text-[var(--ink-soft)]">
                          {r.reviewedBy && `by ${r.reviewedBy}`}
                          {r.reviewedAt && ` on ${new Date(r.reviewedAt).toLocaleDateString()}`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
