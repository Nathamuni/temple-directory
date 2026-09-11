import type { WikiSection as WikiSectionData } from "@/lib/types";

export default function WikiSection({
  num,
  id,
  title,
  section,
  children,
}: {
  num: number;
  id: string;
  title: string;
  section?: WikiSectionData;
  children?: React.ReactNode;
}) {
  return (
    <section id={id}>
      <h2 className="wiki-h2">
        <span className="mr-2 text-[var(--ink-soft)]">{num}.</span>
        {title}
      </h2>
      {section?.paragraphs?.map((p, i) => (
        <p key={i} className="mb-3">
          {p}
          {i === section.paragraphs.length - 1 &&
            section.citations?.map((c) => (
              <sup key={c} className="cite ml-0.5">
                <a href={`#ref-${c}`}>[{c}]</a>
              </sup>
            ))}
        </p>
      ))}
      {children}
    </section>
  );
}
