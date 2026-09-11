"use client";

import { useState } from "react";

const TIERS = [
  { key: "daily", label: "Daily", amount: "₹51", note: "Lamp lit for one day · photo sent" },
  { key: "weekly", label: "Weekly", amount: "₹251", note: "7 days · digital certificate" },
  { key: "monthly", label: "Monthly", amount: "₹751", note: "30 days · certificate + newsletter" },
  { key: "yearly", label: "Yearly", amount: "₹3,651", note: "365 days · monthly photo updates" },
  { key: "forever", label: "Forever", amount: "₹11,000+", note: "Permanent oil fund in your name" },
  { key: "festival", label: "Festival", amount: "₹501", note: "Lit on your chosen festival day" },
  { key: "family", label: "Family", amount: "Custom", note: "Family name & gotra in daily prayer" },
];

export default function LampWidget({
  templeName,
  lampsToday,
}: {
  templeName: string;
  lampsToday: number;
}) {
  const [tier, setTier] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [gotra, setGotra] = useState("");
  const [intention, setIntention] = useState("");
  const [date, setDate] = useState("");
  const [gift, setGift] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selected = TIERS.find((t) => t.key === tier);

  return (
    <div className="border border-[var(--line-soft)] p-4">
      <p className="ui text-sm text-[var(--ink-soft)]">
        🪔 {lampsToday} lamps are burning here today
      </p>

      {submitted && selected ? (
        <div className="mt-3 border-l-4 border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-[15px]">
          <p>
            Your <strong>{selected.label}</strong> lamp at <strong>{templeName}</strong> will be lit
            {date ? ` on ${date}` : " today"}
            {name ? ` in the name of ${name}` : ""}
            {gotra ? ` (${gotra} gotra)` : ""}. A photo of the burning lamp will be sent to you on
            that day.
          </p>
          <p className="ui mt-2 text-xs text-[var(--ink-soft)]">
            This is a prototype preview — payments are not yet enabled.
          </p>
          <button
            className="ui mt-2 text-sm text-[var(--link)] underline"
            onClick={() => setSubmitted(false)}
          >
            Start over
          </button>
        </div>
      ) : (
        <>
          <h3 className="wiki-h3">1 · Choose your lamp</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {TIERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTier(t.key)}
                title={t.note}
                className={`ui border px-2 py-2 text-center text-sm ${
                  tier === t.key
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold"
                    : "border-[var(--line-soft)] bg-[var(--paper)] hover:bg-[var(--paper-soft)]"
                }`}
              >
                <div>{t.key === "forever" ? "🔥 " : ""}{t.label}</div>
                <div className="text-xs text-[var(--ink-soft)]">{t.amount}</div>
              </button>
            ))}
          </div>
          {selected && (
            <p className="ui mt-1.5 text-xs text-[var(--ink-soft)]">{selected.note}</p>
          )}

          <h3 className="wiki-h3">2 · Personalize</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="border border-[var(--line-soft)] px-2 py-1.5 text-sm"
              placeholder="Your name (as announced in prayer) *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="border border-[var(--line-soft)] px-2 py-1.5 text-sm"
              placeholder="Gotra (optional)"
              value={gotra}
              onChange={(e) => setGotra(e.target.value)}
            />
            <input
              className="border border-[var(--line-soft)] px-2 py-1.5 text-sm"
              placeholder="Intention / prayer (optional, 100 chars)"
              maxLength={100}
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
            />
            <input
              type="date"
              aria-label="Lamp date"
              className="border border-[var(--line-soft)] px-2 py-1.5 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <label className="ui mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} />
            Light this lamp as a gift for someone else
          </label>

          <h3 className="wiki-h3">3 · Confirm</h3>
          <button
            className="ui border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selected || !name}
            onClick={() => setSubmitted(true)}
          >
            🪔 Light the Lamp{selected ? ` — ${selected.label} (${selected.amount})` : ""}
          </button>
          <p className="ui mt-1.5 text-xs text-[var(--ink-soft)]">
            Prototype preview — no payment is collected. In production: UPI · Card · Net Banking ·
            PayPal · Wire, with photo proof and a shareable digital certificate.
          </p>
        </>
      )}
    </div>
  );
}
