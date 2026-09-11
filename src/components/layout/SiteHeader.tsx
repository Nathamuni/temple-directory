import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-[var(--line-soft)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-[1100px] items-baseline justify-between gap-4 px-4 py-3">
        <Link href="/" className="!text-[var(--ink)] hover:!no-underline">
          <span className="text-xl">🪔</span>{" "}
          <span className="text-lg font-bold tracking-tight">Temple Directory</span>{" "}
          <span className="ui hidden text-xs text-[var(--ink-soft)] sm:inline">
            — a free encyclopedia of Hindu temples
          </span>
        </Link>
        <nav className="ui flex gap-4 text-sm">
          <Link href="/">Home</Link>
          <Link href="/browse/deity/vishnu">Browse</Link>
          <Link href="/status">Status</Link>
        </nav>
      </div>
    </header>
  );
}
