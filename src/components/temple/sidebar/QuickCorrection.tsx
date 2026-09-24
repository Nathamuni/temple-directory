import type { Temple } from "@/lib/types";
import { IS_STATIC } from "@/lib/staticMode";

/** A visitor who spots a changed timing should not have to become a contributor. */
export default function QuickCorrection({ temple }: { temple: Temple }) {
  // The suggest/propose routes are not part of a static export, so offer no button rather than
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

  // Kept free of per-viewer state so the temple page stays statically rendered;
  // each action checks the session itself and sends visitors to log in first.
  return (
    <div className="mb-3.5 rounded-[18px] border border-line bg-paper p-4 shadow-[var(--shadow-card)]">
      <h3 className="mt-0 mb-3 text-sm font-bold">Suggest a correction</h3>
      <p className="text-xs leading-relaxed text-[#6d5e53]">
        Found a changed timing, rule, facility or description? Tell the editors — any free account
        can. Nothing on the page changes until an editor reviews it.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`/temple/${temple.slug}/suggest`}
          className="inline-block rounded-[10px] bg-[#f1e1c6] px-3 py-2.5 text-xs font-extrabold text-[#5a2a18] hover:no-underline"
        >
          Suggest a correction
        </a>
        <form method="POST" action={`/api/temples/${temple.slug}/follow`}>
          <input type="hidden" name="follow" value="1" />
          <button
            type="submit"
            className="rounded-[10px] border border-line px-3 py-2.5 text-xs font-extrabold text-[#5a2a18]"
          >
            Follow temple
          </button>
        </form>
      </div>
      <p className="mt-3 mb-0 text-xs text-[#6d5e53]">
        Contributor, temple management or priest?{" "}
        <a href={`/temple/${temple.slug}/propose`} className="underline">
          Propose an edit
        </a>
      </p>
    </div>
  );
}
