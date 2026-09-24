import Link from "next/link";
import { getViewer, hasRole } from "@/lib/authz";
import { adminQueueCount } from "@/lib/adminQueue";
import { IS_STATIC } from "@/lib/staticMode";
import EvidenceToggle from "./EvidenceToggle";
import TranslateButton from "./TranslateButton";

export default async function SiteHeader() {
  // On a static export there is no request to read a cookie from, and the
  // editorial routes this nav points at are not built at all.
  const viewer = IS_STATIC ? null : await getViewer();
  const isAdmin = Boolean(viewer?.isAdmin);
  const pending = isAdmin ? adminQueueCount() : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(40,20,16,.96)] text-white backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-[0.02em] hover:no-underline">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[linear-gradient(145deg,#f2c35b,#a95816)] shadow-[inset_0_0_0_2px_rgba(255,255,255,.2)]">
            ॐ
          </span>
          <span className="whitespace-nowrap">
            Temple Directory
            <small className="block text-[10px] font-semibold tracking-[0.16em] text-[#e4c9a0] uppercase">
              Sourced · Verified · Devotional
            </small>
          </span>
        </Link>

        <div className="flex-1" />
        <EvidenceToggle />

        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/">Home</Link>
          {!IS_STATIC && <Link href="/status">Status</Link>}
          {hasRole(viewer, "contributor") && <Link href="/contribute">Contribute</Link>}
          {viewer && <Link href="/account">My account</Link>}
          {isAdmin && (
            <Link href="/admin">
              Admin{pending > 0 && ` (${pending})`}
            </Link>
          )}
          {IS_STATIC ? (
            <span className="text-[11px] tracking-[0.12em] text-[#e4c9a0] uppercase">
              Read-only preview
            </span>
          ) : viewer ? (
            <span className="flex items-baseline gap-2">
              <span className="text-[#d9cec6]">{viewer.username}</span>
              <form method="POST" action="/api/auth/logout">
                <button type="submit" className="underline">
                  Log out
                </button>
              </form>
            </span>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup">Sign up</Link>
            </>
          )}
        </nav>

        <TranslateButton />
      </div>
    </header>
  );
}
