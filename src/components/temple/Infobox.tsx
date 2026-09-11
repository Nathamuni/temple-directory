import type { Temple } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <tr className="align-top">
      <th className="ui w-[38%] py-1.5 pr-2 text-left text-[13px] font-semibold text-[var(--ink)]">
        {label}
      </th>
      <td className="py-1.5 text-[13px] leading-snug">{value}</td>
    </tr>
  );
}

export default function Infobox({ temple }: { temple: Temple }) {
  const { lat, lng } = temple.location.coordinates;
  const bbox = `${lng - 0.01},${lat - 0.007},${lng + 0.01},${lat + 0.007}`;
  return (
    <div className="w-full border border-[var(--line-soft)] bg-[var(--paper-soft)] p-3 lg:w-[300px]">
      <div className="ui border-b border-[var(--line-soft)] pb-2 text-center text-sm font-bold">
        {temple.name}
      </div>
      {temple.nameLocal && (
        <div className="py-1 text-center text-sm">{temple.nameLocal.text}</div>
      )}
      <table className="w-full border-collapse">
        <tbody className="divide-y divide-[var(--line-soft)]/60">
          <Row
            label="Deity (Presiding)"
            value={
              temple.deity.consort
                ? `${temple.deity.presiding} · Consort: ${temple.deity.consort}`
                : temple.deity.presiding
            }
          />
          <Row
            label="Location"
            value={`${temple.location.city}, ${temple.location.state}, ${temple.location.country}`}
          />
          <Row label="Established" value={temple.established.yearText || temple.established.period} />
          <Row label="Temple Type" value={temple.classification.templeType} />
          <Row label="Tradition" value={temple.classification.tradition} />
          <Row label="Architectural Style" value={temple.classification.architecturalStyle} />
          {temple.classification.divyaDesam ? (
            <Row label="Divya Desam" value={`No. ${temple.classification.divyaDesam} of 108`} />
          ) : null}
          <Row label="Governing Body" value={temple.governingBody} />
          <Row
            label="Official Website"
            value={
              temple.website ? (
                <a href={temple.website} rel="noopener noreferrer" target="_blank" className="break-all">
                  {temple.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null
            }
          />
          <Row
            label="Major Festival(s)"
            value={
              temple.festivals?.filter((f) => f.major).map((f) => f.name).join(", ") || null
            }
          />
          <Row
            label="Darshan Timings"
            value={temple.timings?.darshan?.map((d) => `${d.from}–${d.to}`).join(" · ") || null}
          />
          {temple.lamp?.enabled && (
            <Row
              label="Lamps Burning Today"
              value={
                <span>
                  <span aria-hidden>🪔</span> {temple.lamp.lampsToday} active lamps
                </span>
              }
            />
          )}
          <Row
            label="Coordinates"
            value={`${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`}
          />
        </tbody>
      </table>
      <div className="mt-2 border border-[var(--line-soft)]">
        <iframe
          title={`Map of ${temple.name}`}
          className="h-[180px] w-full"
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
        />
      </div>
    </div>
  );
}
