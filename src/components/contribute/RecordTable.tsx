"use client";

import type { FieldSpec, SheetId } from "@/lib/schema";
import { specsForSheet } from "@/lib/schema";
import FieldRow, { labelFor } from "./FieldRow";

type Row = Record<string, unknown>;

/**
 * Add/remove editor for one repeatable sheet. Generic over every child sheet,
 * driven entirely by FIELD_SPECS, so festivals, poojas, shrines, media,
 * sources, hours and SOP steps all get a real editor without bespoke code.
 *
 * Repeatable records are the whole point of the normalized schema: flattening
 * them into Festival_1/Festival_2 columns is what the input model exists to
 * avoid, so they must be editable in the browser and not only via Excel.
 */
export default function RecordTable({
  sheet,
  title,
  rows,
  onChange,
  newRow,
  sourceOptions,
}: {
  sheet: SheetId;
  title: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  newRow: (index: number) => Row;
  /** Source ids the contributor has already entered, for the source picker. */
  sourceOptions?: { id: string; label: string }[];
}) {
  const specs = specsForSheet(sheet).filter((s) => s.path !== null);
  const primary = specs.filter((s) => s.requirement === "Required" || s.requirement === "Recommended");
  const secondary = specs.filter((s) => s.requirement === "Optional");

  function update(index: number, path: string, value: unknown) {
    const next = rows.map((row, i) => (i === index ? { ...row, [path]: value } : row));
    onChange(next);
  }

  return (
    <div className="formgroup">
      <h3 className="display flex items-center justify-between">
        <span>{title}</span>
        <button
          type="button"
          onClick={() => onChange([...rows, newRow(rows.length)])}
          className="rounded-lg bg-[#5a1717] px-3 py-1.5 text-xs font-bold text-white"
        >
          + Add
        </button>
      </h3>

      {rows.length === 0 && (
        <p className="m-0 px-4 py-4 text-[13px] text-muted">
          None recorded yet. Each entry becomes one row on the <code>{sheet}</code> sheet, with its
          own sources and verification state.
        </p>
      )}

      {rows.map((row, index) => (
        <div key={index} className="border-t border-[#eadfcd] px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-xs text-[#7a5a32]">
              {title} {index + 1}
            </b>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className="text-xs font-bold text-[#8b2f22] underline"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {primary.map((spec) => (
              <Cell
                key={spec.column}
                spec={spec}
                value={row[spec.path!]}
                onChange={(v) => update(index, spec.path!, v)}
                sourceOptions={sourceOptions}
              />
            ))}
          </div>

          {secondary.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-bold text-[#7a5a32]">
                Optional fields ({secondary.length})
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {secondary.map((spec) => (
                  <Cell
                    key={spec.column}
                    spec={spec}
                    value={row[spec.path!]}
                    onChange={(v) => update(index, spec.path!, v)}
                    sourceOptions={sourceOptions}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function Cell({
  spec,
  value,
  onChange,
  sourceOptions,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  sourceOptions?: { id: string; label: string }[];
}) {
  const selected = Array.isArray(value) ? (value as string[]) : [];

  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <b className="text-[11px]">{labelFor(spec)}</b>
        <span className={`req ${spec.requirement.toLowerCase()}`}>
          {spec.requirement.slice(0, 3).toUpperCase()}
        </span>
      </span>
      {spec.column === "source_ids" && sourceOptions ? (
        // Sources can only be picked from what the contributor actually entered,
        // so a citation can never point at a source that does not exist.
        <span className="mt-1 flex flex-wrap gap-2">
          {sourceOptions.length === 0 && (
            <span className="text-[11px] text-muted">Add a source below first.</span>
          )}
          {sourceOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, option.id]
                      : selected.filter((id) => id !== option.id)
                  )
                }
              />
              {option.id} — {option.label}
            </label>
          ))}
        </span>
      ) : (
        <span className="mt-1 block">
          <FieldRow spec={spec} value={value} onChange={onChange} compact />
        </span>
      )}
    </label>
  );
}
