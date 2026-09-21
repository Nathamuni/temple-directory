import type { Temple } from "@/lib/types";
import { IS_STATIC } from "@/lib/staticMode";

/** A visitor who spots a changed timing should not have to become a contributor. */
export default function QuickCorrection({ temple }: { temple: Temple }) {
  const subject = encodeURIComponent(`Correction: ${temple.identity.nameEn}`);

  // /contribute is not part of a static export, so offer no button rather than
  // a link that 404s.
  if (IS_STATIC) {
    return (
      <div className="mb-3.5 rounded-[18px] border border-line bg-paper p-4 shadow-[var(--shadow-card)]">
        <h3 className="mt-0 mb-3 text-sm font-bold">Suggest a correction</h3>
        <p className="text-xs leading-relaxed text-[#6d5e53]">
          This is a read-only preview of the directory. Corrections are accepted on the full site,
          where contributors can submit and editors can review them.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3.5 rounded-[18px] border border-line bg-paper p-4 shadow-[var(--shadow-card)]">
      <h3 className="mt-0 mb-3 text-sm font-bold">Suggest a correction</h3>
      <p className="text-xs leading-relaxed text-[#6d5e53]">
        Found a changed timing, rule, facility or description? Tell us — you do not need an account.
      </p>
      <a
        href={`/contribute?correction=${temple.slug}&subject=${subject}`}
        className="inline-block rounded-[10px] bg-[#f1e1c6] px-3 py-2.5 text-xs font-extrabold text-[#5a2a18] hover:no-underline"
      >
        Suggest an edit
      </a>
    </div>
  );
}
