export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--line-soft)] bg-[var(--paper-soft)]">
      <div className="ui mx-auto max-w-[1100px] px-4 py-6 text-xs leading-relaxed text-[var(--ink-soft)]">
        <p>
          Temple Directory — a structured, cited reference of Hindu temples. Prototype build; content
          is verified against a minimum of two sources per entry. Worship SOPs document practices as
          observed at each temple and are reviewed before publication.
        </p>
        <p className="mt-2">
          Photographs are used under Creative Commons licenses with attribution — see{" "}
          <a href="/images/ATTRIBUTIONS.md">image attributions</a>. © CNESS Inc. (prototype).
        </p>
      </div>
    </footer>
  );
}
