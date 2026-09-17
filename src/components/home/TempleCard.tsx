import Link from "next/link";
import type { Temple } from "@/lib/types";
import { heroImage } from "@/lib/temple-view";
import { isVerified } from "@/lib/temple-view";

/* eslint-disable @next/next/no-img-element -- remote CC-licensed sources, no loader configured */
export default function TempleCard({ temple }: { temple: Temple }) {
  const hero = heroImage(temple);
  const verified = isVerified(temple.editorial.overallVerificationStatus);

  return (
    <Link
      href={`/temple/${temple.slug}`}
      className="block overflow-hidden rounded-2xl border border-line bg-paper shadow-[var(--shadow-card)] hover:!no-underline"
    >
      {hero && (
        <img src={hero.fileOrUrl} alt={hero.altText} loading="lazy" className="h-40 w-full object-cover" />
      )}
      <div className="p-3">
        <div className="font-bold leading-snug">{temple.identity.nameEn}</div>
        <div className="mt-0.5 text-xs text-muted">
          {temple.identity.presidingDeity} · {temple.location.city}, {temple.location.stateProvince}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className={`badge ${verified ? "ok" : "warn"}`}>
            {verified ? "Cross-referenced" : "Needs sourcing"}
          </span>
          <span className="text-muted">{temple.identity.templeType}</span>
        </div>
      </div>
    </Link>
  );
}
