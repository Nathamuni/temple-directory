import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildTempleWorkbook } from "@/lib/excel/build";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  // The template is the export with no rows: same 12 sheets, same headers,
  // same dropdowns, so a filled-in template imports without translation.
  const wb = buildTempleWorkbook([]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="temple-directory-import-template.xlsx"',
    },
  });
}
