import type { VerificationStatus } from "@/lib/types";
import { VerificationBadge } from "@/components/evidence/Evidence";

/** One page section: kicker, heading, optional status badge, content. */
export default function Section({
  id,
  kicker,
  title,
  status,
  badge,
  children,
}: {
  id: string;
  kicker?: string;
  title: string;
  status?: VerificationStatus;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section" id={id}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          {kicker && <div className="kicker">{kicker}</div>}
          <h2 className="m-0 text-[26px] leading-tight text-[#4b1715] sm:text-[32px]">{title}</h2>
        </div>
        {status ? <VerificationBadge status={status} /> : badge ? <span className="badge warn">{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}
