import type { ImageRef } from "@/lib/types";

/* eslint-disable @next/next/no-img-element */
export default function ImageWithCredit({
  image,
  className,
}: {
  image: ImageRef;
  className?: string;
}) {
  return (
    <>
      <img src={image.src} alt={image.alt} loading="lazy" className={className} />
      <figcaption className="ui mt-1 text-xs text-[var(--ink-soft)]">
        {image.caption && <span>{image.caption} — </span>}
        <a href={image.credit.sourceUrl} target="_blank" rel="noopener noreferrer">
          {image.credit.author}
        </a>
        , {image.credit.license}, via Wikimedia Commons
      </figcaption>
    </>
  );
}
