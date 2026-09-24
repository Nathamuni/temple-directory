import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { getAllTemples } from "@/lib/temples";
import { buildTempleWorkbook } from "@/lib/excel/build";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  const wb = buildTempleWorkbook(getAllTemples());
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="temple-directory-export.xlsx"',
    },
  });
}
