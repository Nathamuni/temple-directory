export default function TableOfContents({
  items,
}: {
  items: { id: string; title: string }[];
}) {
  return (
    <nav
      aria-label="Contents"
      className="my-6 inline-block border border-[var(--line-soft)] bg-[var(--paper-soft)] px-5 py-3"
    >
      <div className="ui mb-1 text-center text-sm font-bold">Contents</div>
      <ol className="space-y-0.5 text-sm">
        {items.map((item, i) => (
          <li key={item.id}>
            <span className="mr-1.5 text-[var(--ink-soft)]">{i + 1}.</span>
            <a href={`#${item.id}`}>{item.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
