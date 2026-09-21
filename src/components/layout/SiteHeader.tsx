import Link from "next/link";
import { getSession } from "@/lib/session";
import { pendingRequestCount } from "@/lib/users";
import { IS_STATIC } from "@/lib/staticMode";
import EvidenceToggle from "./EvidenceToggle";
import TranslateButton from "./TranslateButton";

export default async function SiteHeader() {
  // On a static export there is no request to read a cookie from, and the
  // editorial routes this nav points at are not built at all.
  const session = IS_STATIC ? null : await getSession();
  const isAdmin = session?.role === "admin";
  const pending = isAdmin ? pendingRequestCount() : 0;

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
          {!IS_STATIC && !isAdmin && <Link href="/contribute">Contribute</Link>}
          {session && <Link href="/my-submissions">My Submissions</Link>}
          {isAdmin && (
            <Link href="/admin/contributor-requests">
              Contributor Requests{pending > 0 && ` (${pending})`}
            </Link>
          )}
          {isAdmin && <Link href="/admin/bulk-import">Bulk Import</Link>}
          {IS_STATIC ? (
            <span className="text-[11px] tracking-[0.12em] text-[#e4c9a0] uppercase">
              Read-only preview
            </span>
          ) : session ? (
            <span className="flex items-baseline gap-2">
              <span className="text-[#d9cec6]">
                {session.username} ({session.role})
              </span>
              <form method="POST" action="/api/auth/logout">
                <button type="submit" className="underline">
                  Log out
                </button>
              </form>
            </span>
          ) : (
            <Link href="/login">Log in</Link>
          )}
        </nav>

        <TranslateButton />
      </div>
    </header>
  );
}
