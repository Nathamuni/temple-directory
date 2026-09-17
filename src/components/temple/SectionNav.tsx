/** Sticky in-page nav. Sections with no content are never passed in. */
export default function SectionNav({ items }: { items: { id: string; title: string }[] }) {
  return (
    <nav
      aria-label="On this temple"
      className="mb-3.5 max-h-max overflow-auto whitespace-nowrap rounded-[18px] border border-line bg-paper/80 p-3.5 shadow-[var(--shadow-card)] lg:sticky lg:top-[78px] lg:mb-0 lg:whitespace-normal"
    >
      <div className="px-2.5 pt-2 pb-2.5 text-[11px] font-black tracking-[0.15em] text-[#9a7b54] uppercase">
        On this temple
      </div>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="inline-block rounded-[10px] px-2.5 py-2 text-[13px] font-bold text-[#64564d] hover:bg-[#f0e2ca] hover:text-maroon hover:no-underline lg:block"
        >
          {item.title}
        </a>
      ))}
    </nav>
  );
}
