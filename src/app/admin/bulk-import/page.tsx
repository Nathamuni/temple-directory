import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getImportReport } from "@/lib/importReports";

export const metadata: Metadata = { title: "Bulk Import" };

const CARD = "mt-5 rounded-[18px] border border-line bg-paper p-5 shadow-[var(--shadow-card)]";
const BUTTON =
  "mt-3 inline-block rounded-xl bg-maroon px-4 py-2.5 font-bold text-white hover:no-underline";

export default async function BulkImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; report?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/bulk-import");
  if (session.role !== "admin") redirect("/status");

  const { error, report: reportId } = await searchParams;
  const report = getImportReport(reportId);
  const errors = report?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = report?.issues.filter((i) => i.level === "warning") ?? [];

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="display text-3xl">Bulk import / export</h1>
      <p className="mt-1 text-sm text-muted">
        The workbook has one sheet per entity — Temple Master plus Visiting Info, Opening Hours,
        Worship SOP, Shrines, Poojas, Festivals, Media and Sources — joined by{" "}
        <code>temple_id</code>. Rows are matched to existing entries on <code>temple_id</code>: a
        new id creates a draft, a known id updates that temple. Import never publishes, and
        updating a live entry takes it off the site until an admin re-reviews it.
      </p>

      {error && (
        <div className="alert mt-4">
          <span aria-hidden>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {report && (
        <div className={CARD}>
          <h2 className="display mt-0 text-xl">
            Result — <code className="text-base">{report.fileName}</code>
          </h2>
          <p className="mt-1 text-sm">
            <b>{report.created.length}</b> created, <b>{report.updated.length}</b> updated,{" "}
            <b>{report.unchanged}</b> unchanged, <b>{report.skipped.length}</b> skipped,{" "}
            <b>{errors.length}</b> error
            {errors.length === 1 ? "" : "s"}, <b>{warnings.length}</b> warning
            {warnings.length === 1 ? "" : "s"}.
          </p>

          {report.created.length === 0 && report.updated.length === 0 && report.skipped.length === 0 && (
            <p className="mt-2 text-sm text-muted">
              Nothing to do — every row matched an existing temple and was identical to what is
              already stored.
            </p>
          )}

          {report.created.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-bold">Created as drafts</h3>
              <ul className="list-disc pl-5 text-sm">
                {report.created.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/temple/${item.slug}`}>{item.name}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {report.updated.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-bold">
                Updated (matched on <code>temple_id</code>)
              </h3>
              <ul className="list-disc pl-5 text-sm">
                {report.updated.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/temple/${item.slug}`}>{item.name}</Link>
                    {item.unpublished && (
                      <span className="badge warn ml-2">taken off the site for re-review</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {report.skipped.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-bold">Skipped</h3>
              <ul className="list-disc pl-5 text-sm text-[#7b3518]">
                {report.skipped.map((item, index) => (
                  <li key={index}>
                    {item.name} — {item.reason}
                  </li>
                ))}
              </ul>
            </>
          )}

          {report.issues.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-bold">Per-sheet issues</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-soft text-left">
                      <th className="border border-line px-2 py-1.5">Sheet</th>
                      <th className="border border-line px-2 py-1.5">Row</th>
                      <th className="border border-line px-2 py-1.5">Column</th>
                      <th className="border border-line px-2 py-1.5">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...errors, ...warnings].map((issue, index) => (
                      <tr key={index}>
                        <td className="border border-line px-2 py-1.5 whitespace-nowrap">
                          <span className={`badge ${issue.level === "error" ? "warn" : "ok"}`}>
                            {issue.level}
                          </span>{" "}
                          {issue.sheet}
                        </td>
                        <td className="border border-line px-2 py-1.5">{issue.row || "—"}</td>
                        <td className="border border-line px-2 py-1.5">
                          <code>{issue.column ?? "—"}</code>
                        </td>
                        <td className="border border-line px-2 py-1.5">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <section className={CARD}>
        <h2 className="display mt-0 text-xl">1. Download the template</h2>
        <p className="mt-1 text-sm text-muted">
          Every sheet with its full header row, dropdowns for the enumerated columns, the Column
          Dictionary and the Lookups. This is the same file an export produces, so a filled-in
          template imports without translation.
        </p>
        <a href="/api/admin/temples/template" className={BUTTON}>
          Download template (.xlsx)
        </a>
      </section>

      <section className={CARD}>
        <h2 className="display mt-0 text-xl">2. Export what is already there</h2>
        <p className="mt-1 text-sm text-muted">
          Every temple in the directory, any status, across all nine data sheets. This is also the
          file to edit and re-import when correcting existing entries in bulk.
        </p>
        <a href="/api/admin/temples/export" className={BUTTON}>
          Export current data (.xlsx)
        </a>
      </section>

      <section className={CARD}>
        <h2 className="display mt-0 text-xl">3. Import</h2>
        <p className="mt-1 text-sm text-muted">
          Re-importing an exported file creates new drafts — it does not update temples already on
          the site. Cell comments and Excel tables in your workbook are ignored rather than
          rejected.
        </p>
        <p className="mt-2 text-sm text-muted">
          Loading a large batch into a fresh install is better done from the command line:{" "}
          <code>npm run import &lt;file.xlsx&gt;</code> — no upload limit or request timeout, and the
          resulting data files can be reviewed in git before you commit them.
        </p>
        <form method="POST" action="/api/admin/temples/import" encType="multipart/form-data" className="mt-3">
          <input type="file" name="file" accept=".xlsx" required className="block text-sm" />
          <button type="submit" className={BUTTON}>
            Import
          </button>
        </form>
      </section>
    </div>
  );
}
