"use client";

import type { FieldSpec } from "@/lib/schema";
import { LOOKUPS } from "@/lib/schema";

/**
 * One row of the contributor form, laid out like the prototype's .formrow:
 * human label + the workbook's own column name + the input + a requirement
 * chip. Everything comes from FIELD_SPECS, so the form can never drift from
 * the schema the importer and the publish gate use.
 */

/** "temple_name_en" -> "Temple name en" is unhelpful; use the dictionary's wording. */
export function labelFor(spec: FieldSpec): string {
  const words = spec.column.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function FieldRow({
  spec,
  value,
  onChange,
  compact = false,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (next: unknown) => void;
  compact?: boolean;
}) {
  const id = `f-${spec.sheet}-${spec.column}`;
  const asText = Array.isArray(value) ? value.join("; ") : value === undefined || value === null ? "" : String(value);

  function emit(raw: string) {
    if (spec.list) {
      onChange(raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean));
      return;
    }
    if (spec.dataType === "Decimal" || spec.dataType === "Integer") {
      onChange(raw === "" ? undefined : Number(raw));
      return;
    }
    onChange(raw === "" ? undefined : raw);
  }

  const options = spec.lookup ? LOOKUPS[spec.lookup] : undefined;

  const control =
    spec.dataType === "Boolean" ? (
      <input
        id={id}
        type="checkbox"
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    ) : options ? (
      <select id={id} className="field-input" value={asText} onChange={(e) => emit(e.target.value)}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : spec.dataType === "Long text" ? (
      <textarea
        id={id}
        className="field-input"
        rows={compact ? 2 : 4}
        value={asText}
        onChange={(e) => emit(e.target.value)}
        placeholder={spec.description}
      />
    ) : (
      <input
        id={id}
        className="field-input"
        type={
          spec.dataType === "Date"
            ? "date"
            : spec.dataType === "Time"
              ? "time"
              : spec.dataType === "Decimal" || spec.dataType === "Integer"
                ? "number"
                : spec.dataType === "URL"
                  ? "url"
                  : "text"
        }
        step={spec.dataType === "Decimal" ? "any" : undefined}
        value={asText}
        onChange={(e) => emit(e.target.value)}
        placeholder={spec.description}
      />
    );

  if (compact) return control;

  return (
    <div className="formrow">
      <label htmlFor={id} className="block">
        <b className="block text-xs">{labelFor(spec)}</b>
        <code className="text-[10px] text-[#866f5b]">{spec.column}</code>
      </label>
      <div>
        {control}
        {spec.description && <p className="mt-1 mb-0 text-[11px] text-[#7c6b5f]">{spec.description}</p>}
      </div>
      <span className={`req ${spec.requirement.toLowerCase()}`}>{spec.requirement.toUpperCase()}</span>
    </div>
  );
}
