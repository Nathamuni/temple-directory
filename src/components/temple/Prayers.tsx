import type { Temple } from "@/lib/types";
import {
  deityLabel,
  langForScript,
  librarySlokasFor,
  pendingTempleMantraCount,
  publicTempleMantras,
  type LibrarySloka,
  type PublicMantra,
} from "@/lib/mantras";
import Section from "./Section";

/**
 * Prayers & slokas. Two clearly separated groups:
 *  - "At this temple": temple-specific hymns, only once the priest verified them.
 *  - "Traditional slokas for <deity>": general slokas from the shared library,
 *    labelled as not confirmed by this temple.
 */

type Card = {
  key: string;
  title: string;
  textOriginal?: string;
  script?: string;
  transliteration?: string;
  meaning?: string;
  sourceText?: string;
  sourceUrl?: string;
  whenChanted?: string;
  repetitions?: number;
  textHidden?: boolean;
};

/** Keep a verse-end danda (। ॥, or | in romanisation) on the line it ends. */
function keepDandas(text: string | undefined): string | undefined {
  return text?.replace(/ +([।॥|]+)/g, "\u00a0$1");
}

function fromLibrary(s: LibrarySloka): Card {
  return { key: s.mantraId, ...s };
}

function fromTemple(m: PublicMantra): Card {
  return { key: m.mantraId, ...m };
}

function SlokaCard({ card, badge }: { card: Card; badge: { text: string; ok: boolean } }) {
  const lang = langForScript(card.script);
  const facts = [card.whenChanted && `Chanted: ${card.whenChanted}`, card.repetitions && `${card.repetitions}×`]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={`info-card ${(card.textOriginal?.split("\n").length ?? 0) > 4 ? "lg:col-span-2" : ""}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <b>{card.title}</b>
        <span className={`badge ${badge.ok ? "ok" : "warn"}`}>{badge.text}</span>
      </div>
      {card.textHidden ? (
        <p className="m-0 text-[13px] text-[#67574c]">
          Chanted by initiated devotees and priests only, so the text is not published.
        </p>
      ) : (
        <>
          {card.textOriginal && (
            <p lang={lang} className="display m-0 rounded-xl bg-[#f6ecd8] px-3 py-2 text-[17px] leading-relaxed whitespace-pre-line">
              {keepDandas(card.textOriginal)}
            </p>
          )}
          {card.transliteration && (
            <p className="mt-2 mb-0 text-[13px] leading-relaxed whitespace-pre-line text-[#56473e] italic">
              {keepDandas(card.transliteration)}
            </p>
          )}
        </>
      )}
      {card.meaning && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold text-[#5a2a18]">Meaning</summary>
          <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-[#67574c]">{card.meaning}</p>
        </details>
      )}
      {(facts || card.sourceText) && (
        <p className="mt-2 mb-0 text-xs text-[#77634f]">
          {facts}
          {facts && card.sourceText && " · "}
          {card.sourceText &&
            (card.sourceUrl ? (
              <>
                Source:{" "}
                <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {card.sourceText}
                </a>
              </>
            ) : (
              <>Source: {card.sourceText}</>
            ))}
        </p>
      )}
    </div>
  );
}

export default function Prayers({ temple }: { temple: Temple }) {
  const templeMantras = publicTempleMantras(temple);
  const general = librarySlokasFor(temple);
  const pending = pendingTempleMantraCount(temple);
  if (templeMantras.length === 0 && general.length === 0) return null;
  const deity = deityLabel(temple);
  // Only claim "for <deity>" when a deity-specific sloka is actually listed
  // (e.g. Pushkar has only the universal Ganesha invocation so far).
  const hasDeitySloka = general.some((s) => !s.appliesTo.all) || deity === "Ganesha";

  return (
    <Section id="prayers" kicker="Chant" title="Prayers & slokas">
      {templeMantras.length > 0 && (
        <>
          <h3 className="mt-0 mb-2 text-base">At this temple</h3>
          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {templeMantras.map((m) => (
              <SlokaCard key={m.mantraId} card={fromTemple(m)} badge={{ text: "Confirmed by the temple's priest", ok: true }} />
            ))}
          </div>
        </>
      )}
      {pending > 0 && (
        <p className="mt-0 mb-4 text-xs text-[#77634f]">
          {pending} temple-specific {pending === 1 ? "hymn is" : "hymns are"} awaiting the temple priest&apos;s
          confirmation and will appear here once verified.
        </p>
      )}
      {general.length > 0 && (
        <>
          <h3 className="mt-0 mb-1 text-base">
            {hasDeitySloka ? `Traditional slokas for ${deity}` : "Traditional invocation"}
          </h3>
          <p className="mt-0 mb-3 text-xs text-[#77634f]">
            {hasDeitySloka
              ? `Widely recited wherever ${deity} is worshipped.`
              : "Ganesha is invoked first at the start of any worship."}{" "}
            Not yet confirmed by this temple — its own practice may differ.
          </p>
          <div className="grid grid-flow-row-dense grid-cols-1 gap-3 lg:grid-cols-2">
            {general.map((s) => (
              <SlokaCard key={s.mantraId} card={fromLibrary(s)} badge={{ text: "Traditional", ok: false }} />
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
