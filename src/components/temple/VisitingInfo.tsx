import type { Temple } from "@/lib/types";

export default function VisitingInfo({ info, timings }: { info: Temple["visitingInfo"]; timings: Temple["timings"] }) {
  if (!info) return null;
  const rows: [string, React.ReactNode][] = [
    ["Darshan Timings", timings?.darshan?.map((d) => `${d.label}: ${d.from}–${d.to}`).join(" · ")],
    ["Best Time to Visit", info.bestTime],
    ["Dress Code", info.dressCode],
    ["By Air", info.howToReach?.air],
    ["By Rail", info.howToReach?.rail],
    ["By Road", info.howToReach?.road],
    ["Entry Fee", info.entryFee],
    ["Facilities", info.facilities?.length ? info.facilities.join(" · ") : null],
    [
      "Nearby Attractions",
      info.nearbyAttractions?.length ? info.nearbyAttractions.join(" · ") : null,
    ],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <tr key={label}>
                <th className="ui w-[30%] border border-[var(--line-soft)] bg-[var(--paper-soft)] px-3 py-1.5 text-left align-top">
                  {label}
                </th>
                <td className="border border-[var(--line-soft)] px-3 py-1.5">{value}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {timings?.pujaSchedule?.length ? (
        <>
          <h3 className="wiki-h3">Daily Puja Schedule</h3>
          <ul className="list-disc pl-6 text-sm">
            {timings.pujaSchedule.map((p) => (
              <li key={p.time + p.name}>
                <span className="ui font-semibold">{p.time}</span> — {p.name}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
