import type { Temple } from "@/lib/types";
import { approvedMedia } from "@/lib/temple-view";
import Section from "./Section";
import MediaFigure from "./MediaFigure";

/** Imagery that helps a devotee understand the temple, not decorate the page. */
export default function ArchitectureGallery({ temple }: { temple: Temple }) {
  const images = approvedMedia(temple, ["gopuram", "architecture", "tank", "exterior", "shrine"]);
  const style = temple.narrative.architectureStyle;
  if (images.length === 0 && !style) return null;

  const [lead, ...rest] = images;

  return (
    <Section id="architecture" kicker="See what makes the complex distinct" title="Architecture & sacred art">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.6fr]">
        {lead && <MediaFigure media={lead} imgClassName="min-h-[230px] h-full" />}
        <div className="grid content-start gap-3">
          {style && (
            <div className="info-card">
              <b className="mb-1.5 block">{style}</b>
              <p className="m-0 text-[13px] leading-relaxed text-[#67574c]">
                Recorded architectural tradition for this temple.
                {temple.governance.establishedEra ? ` Established: ${temple.governance.establishedEra}.` : ""}
              </p>
            </div>
          )}
          {rest.slice(0, 2).map((media) => (
            <MediaFigure key={media.mediaId} media={media} imgClassName="max-h-44" />
          ))}
        </div>
      </div>
      {rest.length > 2 && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {rest.slice(2).map((media) => (
            <MediaFigure key={media.mediaId} media={media} imgClassName="max-h-44" />
          ))}
        </div>
      )}
    </Section>
  );
}
