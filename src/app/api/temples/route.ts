import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { DATA_DIR, slugify, invalidateTempleCache } from "@/lib/temples";
import { validateContribution, buildDraftTemple, type ContributionInput } from "@/lib/contributionInput";

function uniqueSlug(base: string): string {
  let slug = base;
  let n = 2;
  while (fs.existsSync(path.join(DATA_DIR, `${slug}.json`))) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function POST(req: NextRequest) {
  let body: Partial<ContributionInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateContribution(body);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const slug = uniqueSlug(slugify(body.name!));
  const temple = buildDraftTemple(slug, body as ContributionInput);
  fs.writeFileSync(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(temple, null, 2) + "\n");
  invalidateTempleCache();

  return NextResponse.json({ slug }, { status: 201 });
}
