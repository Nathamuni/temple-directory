import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { upsertTempleFromImport } from "@/lib/temples";
import { parseTempleWorkbook } from "@/lib/excel/parse";
import { validateTemple } from "@/lib/validate";
import { saveImportReport } from "@/lib/importReports";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  const resultUrl = new URL("/admin/bulk-import", request.url);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    resultUrl.searchParams.set("error", "Choose an .xlsx file to import.");
    return NextResponse.redirect(resultUrl, { status: 303 });
  }

  const { temples, issues } = await parseTempleWorkbook(await file.arrayBuffer());

  if (temples.length === 0) {
    const id = saveImportReport({ fileName: file.name, created: [], updated: [], unchanged: 0, skipped: [], issues });
    resultUrl.searchParams.set("report", id);
    resultUrl.searchParams.set("error", "No temple rows were read from 01_Temple_Master.");
    return NextResponse.redirect(resultUrl, { status: 303 });
  }

  /**
   * Rows with structural errors were already dropped by the parser, so what
   * reaches here is coherent. Rows are matched to existing temples by
   * temple_id, so re-importing an export updates rather than duplicating.
   * A temple still missing required content is kept as a draft and flagged —
   * bulk import never publishes, so an incomplete draft is the correct
   * landing place rather than a rejection.
   */
  const created: { slug: string; name: string }[] = [];
  const updated: { slug: string; name: string; unpublished: boolean }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let unchanged = 0;

  for (const temple of temples) {
    const name = temple.identity.nameEn || temple.templeId;
    const blockers = validateTemple(temple).filter((i) => i.level === "error");
    if (!temple.identity.nameEn) {
      skipped.push({ name, reason: "temple_name_en is empty" });
      continue;
    }
    try {
      const outcome = upsertTempleFromImport(temple, viewer.username);
      if (outcome.action === "unchanged") {
        unchanged += 1;
      } else if (outcome.action === "created") {
        created.push({ slug: outcome.temple.slug, name });
      } else {
        updated.push({
          slug: outcome.temple.slug,
          name,
          unpublished: outcome.unpublished === true,
        });
      }
      if (blockers.length) {
        issues.push({
          sheet: "01_Temple_Master",
          row: 0,
          level: "warning",
          message: `${name}: imported as a draft with ${blockers.length} required field(s) still empty`,
        });
      }
    } catch (error) {
      skipped.push({ name, reason: (error as Error).message });
    }
  }

  const id = saveImportReport({ fileName: file.name, created, updated, unchanged, skipped, issues });
  resultUrl.searchParams.set("report", id);
  return NextResponse.redirect(resultUrl, { status: 303 });
}
