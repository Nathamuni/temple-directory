"use client";

import { useMemo, useState } from "react";
import type { Temple } from "@/lib/types";
import { specsForSheet } from "@/lib/schema";
import { blankTemple } from "@/lib/blankTemple";
import { completeness, validateTemple } from "@/lib/validate";
import { getPath, setPath } from "@/lib/paths";
import { AREA_LABEL, type Area } from "@/lib/fieldAuthority";
import FieldRow from "./FieldRow";
import RecordTable from "./RecordTable";

/**
 * The contributor workspace. It shows the same information architecture the
 * public page renders, grouped by the Column Dictionary's `public_section`, so
 * a contributor can see where each field will end up.
 *
 * State is held client-side and submitted as one JSON POST, which means the
 * request body IS a Temple draft — the exact shape the Excel importer produces.
 * Both pipelines therefore run the identical validator, rather than the three
 * divergent required-field lists this replaced.
 */

const MASTER_GROUPS: { title: string; area: Area; columns: string[] }[] = [
  {
    title: "1. Temple identity",
    area: "identity",
    columns: [
      "temple_name_en",
      "temple_name_local",
      "local_language",
      "alternate_names",
      "presiding_deity",
      "presiding_deity_local",
      "consort_deity",
      "temple_tradition",
      "sampradaya_agama",
      "temple_type",
      "sacred_classifications",
    ],
  },
  {
    title: "2. Location",
    area: "location",
    columns: ["city", "district", "state_province", "country", "postal_code", "latitude", "longitude", "map_url"],
  },
  {
    title: "3. Sacred identity & history",
    area: "narrative",
    columns: [
      "spiritual_significance_short",
      "summary_intro",
      "sthala_puranam",
      "documented_history",
      "architecture_style",
      "sacred_tree",
      "sacred_tank",
      "sacred_text_references",
      "associated_saints",
      "inscriptions_summary",
    ],
  },
  {
    title: "4. Governance & contact",
    area: "governance",
    columns: [
      "established_era",
      "founder_patron",
      "managing_authority",
      "administration_type",
      "official_website",
      "official_phone",
      "official_email",
    ],
  },
];

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

/** The one master-sheet column that belongs to a different area than its group. */
function columnArea(column: string, groupArea: Area): Area {
  return column === "sampradaya_agama" ? "identity.sampradayaAgama" : groupArea;
}

export default function TempleForm({
  initial,
  action,
  submitLabel,
  editableAreas,
  confirmableAreas = [],
  revision = false,
  doneHref = "/my-submissions",
}: {
  initial?: Temple;
  action: string;
  submitLabel: string;
  /** When set, only these areas are shown — the server enforces the same list. */
  editableAreas?: Area[];
  /** Areas the user may confirm as current without editing (temple authorities). */
  confirmableAreas?: Area[];
  /** Post `{ proposed, confirmedAreas, note }` instead of a bare draft. */
  revision?: boolean;
  doneHref?: string;
}) {
  const [draft, setDraft] = useState<Temple>(() => initial ?? blankTemple());
  const [confirmed, setConfirmed] = useState<Area[]>([]);
  const [note, setNote] = useState("");
  const show = (area: Area) => !editableAreas || editableAreas.includes(area);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issues = useMemo(() => validateTemple(draft), [draft]);
  const score = useMemo(() => completeness(draft), [draft]);
  const errors = issues.filter((i) => i.level === "error");

  const sourceOptions = useMemo(
    () =>
      draft.sources.map((source) => ({
        id: source.sourceId,
        label: source.title || source.publisherOrAuthority || "untitled",
      })),
    [draft.sources]
  );

  function setField(path: string, value: unknown) {
    setDraft((current) => {
      const next = structuredClone(current) as unknown as Record<string, unknown>;
      setPath(next, path, value);
      return next as unknown as Temple;
    });
  }

  function setCollection(key: keyof Temple, rows: Record<string, unknown>[]) {
    setDraft((current) => ({ ...current, [key]: rows }) as Temple);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(revision ? { proposed: draft, confirmedAreas: confirmed, note } : draft),
      });
      const result = (await response.json()) as { ok: boolean; slug?: string; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error ?? `Save failed (${response.status}).`);
        return;
      }
      window.location.href = doneHref;
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const masterSpecs = specsForSheet("01_Temple_Master");
  const visitingSpecs = specsForSheet("02_Visiting_Info").filter(
    (s) => s.path !== null && s.column !== "source_ids"
  );

  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-3 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="mb-4 rounded-[22px] bg-[linear-gradient(145deg,#49211b,#2b1714)] p-6 text-white">
          <div className="text-[13px] font-extrabold tracking-[0.18em] text-[#f5c86d] uppercase">
            Contributor workspace
          </div>
          <h1 className="display my-1.5 text-[30px]">
            {draft.identity.nameEn || "New temple entry"}
          </h1>
          <p className="m-0 text-sm text-[#e8dbd0]">
            Structured content entry with field-level evidence and repeatable records. Submitting
            never publishes anything — it creates a draft for editorial review.
          </p>
          <div className="my-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#efbf59]" style={{ width: `${score.pct}%` }} />
          </div>
          <small>
            {score.pct}% complete · {errors.length} required field(s) still empty
          </small>
        </div>

        {error && (
          <div className="alert mb-4">
            <span aria-hidden>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        {MASTER_GROUPS.filter((group) => group.columns.some((c) => show(columnArea(c, group.area)))).map((group) => (
          <div key={group.title} className="formgroup">
            <h3 className="display">{group.title}</h3>
            {group.columns.map((column) => {
              const spec = masterSpecs.find((s) => s.column === column);
              if (!spec?.path || !show(columnArea(column, group.area))) return null;
              return (
                <FieldRow
                  key={column}
                  spec={spec}
                  value={getPath(draft, spec.path)}
                  onChange={(value) => setField(spec.path!, value)}
                />
              );
            })}
          </div>
        ))}

        {show("visitingInfo") && (
        <div className="formgroup">
          <h3 className="display">5. Visiting information</h3>
          {visitingSpecs.map((spec) => (
            <FieldRow
              key={spec.column}
              spec={spec}
              value={getPath(draft.visitingInfo, spec.path!)}
              onChange={(value) => setField(`visitingInfo.${spec.path}`, value)}
            />
          ))}
        </div>
        )}

        {show("sources") && (
        <RecordTable
          sheet="09_Sources"
          title="Sources"
          rows={draft.sources as unknown as Record<string, unknown>[]}
          onChange={(rows) => setCollection("sources", rows)}
          newRow={(i) => ({
            sourceId: `SRC${pad(i + 1)}`,
            sourceType: "other",
            title: "",
            claimScope: "",
            accessDate: new Date().toISOString().slice(0, 10),
            adminApproved: false,
          })}
        />
        )}

        {show("media") && (
        <RecordTable
          sheet="08_Media"
          title="Media"
          rows={draft.media as unknown as Record<string, unknown>[]}
          onChange={(rows) => setCollection("media", rows)}
          newRow={(i) => ({
            mediaId: `MED${pad(i + 1)}`,
            mediaType: "image",
            category: i === 0 ? "hero" : "architecture",
            title: "",
            caption: "",
            altText: "",
            fileOrUrl: "",
            license: "",
            attributionText: "",
            editorialApproved: false,
            verificationStatus: "pending",
          })}
        />
        )}

        {show("openingHours") && (
        <RecordTable
          sheet="03_Opening_Hours"
          title="Opening hours"
          rows={draft.openingHours as unknown as Record<string, unknown>[]}
          onChange={(rows) => setCollection("openingHours", rows)}
          sourceOptions={sourceOptions}
          newRow={(i) => ({
            hoursId: `HRS${pad(i + 1)}`,
            dayType: "daily",
            sessionName: "",
            closedFlag: false,
            sourceIds: [],
            verificationStatus: "needs recheck",
          })}
        />
        )}

        {show("worshipSop") && (
        <RecordTable
          sheet="04_Worship_SOP"
          title="Worship SOP step"
          rows={draft.worshipSop as unknown as Record<string, unknown>[]}
          onChange={(rows) => setCollection("worshipSop", rows)}
          sourceOptions={sourceOptions}
          newRow={(i) => ({
            sopStepId: `SOP${pad(i + 1)}`,
            stepNumber: Math.min(i + 1, 6),
            stepTitle: "",
            instruction: "",
            linkedShrineIds: [],
            linkedMediaIds: [],
            sourceIds: [],
            verificationStatus: "draft",
          })}
        />
        )}

        {show("shrines") && (
        <RecordTable
          sheet="05_Shrines_Route"
          title="Shrine / sacred space"
          rows={draft.shrines as unknown as Record<string, unknown>[]}
          onChange={(rows) => setCollection("shrines", rows)}
          sourceOptions={sourceOptions}
          newRow={(i) => ({
            shrineId: `SHR${pad(i + 1)}`,
            shrineName: "",
            spaceType: "shrine",
            linkedMediaIds: [],
            sourceIds: [],
            verificationStatus: "unverified",
          })}
        />
        )}

        {show("poojas") && (
        <RecordTable
          sheet="06_Pooja_Seva"
          title="Pooja / seva"
          rows={draft.poojas as unknown as Record<string, unknown>[]}
          onChange={(rows) => setCollection("poojas", rows)}
          sourceOptions={sourceOptions}
          newRow={(i) => ({
            poojaId: `PUJ${pad(i + 1)}`,
            recordType: "pooja",
            nameEn: "",
            linkedMediaIds: [],
            sourceIds: [],
            verificationStatus: "needs recheck",
          })}
        />
        )}

        {show("festivals") && (
        <RecordTable
          sheet="07_Festivals"
          title="Festival"
          rows={draft.festivals as unknown as Record<string, unknown>[]}
          onChange={(rows) => setCollection("festivals", rows)}
          sourceOptions={sourceOptions}
          newRow={(i) => ({
            festivalId: `FES${pad(i + 1)}`,
            festivalNameEn: "",
            significance: "",
            linkedMediaIds: [],
            sourceIds: [],
            verificationStatus: "needs recheck",
          })}
        />
        )}

        {revision && confirmableAreas.length > 0 && (
          <div className="formgroup">
            <h3 className="display">Confirm as current</h3>
            <p className="text-sm text-muted">
              Tick a section to confirm, as the temple&apos;s authority, that everything in it is correct
              today — even if you changed nothing. Once an admin approves, its records show as
              authority-verified.
            </p>
            {confirmableAreas.map((area) => (
              <label key={area} className="mr-4 inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed.includes(area)}
                  onChange={(e) =>
                    setConfirmed((current) =>
                      e.target.checked ? [...current, area] : current.filter((a) => a !== area)
                    )
                  }
                />
                {AREA_LABEL[area]}
              </label>
            ))}
          </div>
        )}

        {revision && (
          <div className="formgroup">
            <h3 className="display">Note for the reviewer</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              aria-label="Note for the reviewer"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="What changed and where it comes from — e.g. the notice board, the temple office."
            />
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-xl bg-maroon px-5 py-3 font-extrabold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>

      <aside className="max-h-max xl:sticky xl:top-[78px]">
        <div className="mb-3.5 rounded-[18px] border border-line bg-paper p-4 shadow-[var(--shadow-card)]">
          <h3 className="mt-0 mb-3 text-sm font-bold">Submission readiness</h3>
          {score.bySection.map((section) => (
            <div
              key={section.section}
              className="flex justify-between gap-3 border-t border-[#eee0c8] py-2.5 text-xs first-of-type:border-t-0"
            >
              <span>{section.section}</span>
              <span className={`badge ${section.pct >= 80 ? "ok" : "warn"}`}>{section.pct}%</span>
            </div>
          ))}
        </div>

        <div className="rounded-[18px] border border-line bg-paper p-4 shadow-[var(--shadow-card)]">
          <h3 className="mt-0 mb-3 text-sm font-bold">Editorial flags</h3>
          {errors.length === 0 ? (
            <p className="m-0 text-xs text-muted">Nothing blocking. Recommended fields may still be empty.</p>
          ) : (
            <ul className="m-0 list-disc space-y-1 pl-4 text-xs text-[#6d5e53]">
              {errors.slice(0, 12).map((issue, index) => (
                <li key={`${issue.path}-${index}`}>
                  <code>{issue.column || issue.path}</code> — {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
