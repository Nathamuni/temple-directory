import type { MediaItem } from "@/lib/types";

/** An approved media item with its attribution — licence credit is never optional. */
export default function MediaFigure({
  media,
  className = "",
  imgClassName = "",
}: {
  media: MediaItem;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <figure className={`m-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote CC-licensed sources, no loader configured */}
      <img
        src={media.fileOrUrl}
        alt={media.altText}
        loading="lazy"
        className={`w-full rounded-2xl object-cover ${imgClassName}`}
      />
      <figcaption className="mt-2 text-[11px] text-[#6b5a4b]">
        {media.caption}
        {media.attributionText && (
          <>
            {" · "}
            {media.sourceUrl ? (
              <a href={media.sourceUrl} target="_blank" rel="noopener noreferrer">
                {media.attributionText}
              </a>
            ) : (
              media.attributionText
            )}
          </>
        )}
      </figcaption>
    </figure>
  );
}
