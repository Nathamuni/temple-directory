import Link from "next/link";
import type { Temple } from "@/lib/types";
import { getTemple } from "@/lib/temples";

export default function NearbyTemples({ nearby }: { nearby: Temple["extensions"]["nearbyTemples"] }) {
  if (!nearby?.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-6 text-[15px]">
      {nearby.map((n) => {
        const exists = n.slug ? getTemple(n.slug) : undefined;
        return (
          <li key={n.name}>
            {exists ? <Link href={`/temple/${n.slug}`}>{n.name}</Link> : n.name}
            <span className="text-sm text-muted"> — {n.distanceKm} km</span>
          </li>
        );
      })}
    </ul>
  );
}
