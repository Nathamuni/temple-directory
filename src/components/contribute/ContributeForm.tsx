"use client";

import { useState } from "react";

interface ReferenceRow {
  title: string;
  url: string;
  publisher: string;
}

const EMPTY_REFERENCE: ReferenceRow = { title: "", url: "", publisher: "" };

const INITIAL_FORM = {
  name: "",
  subtitle: "",
  deityPresiding: "",
  deityConsort: "",
  locationCity: "",
  locationDistrict: "",
  locationState: "",
  locationCountry: "India",
  locationAddress: "",
  locationLat: "",
  locationLng: "",
  templeType: "",
  tradition: "",
  architecturalStyle: "",
  tags: "",
  establishedPeriod: "",
  establishedYearText: "",
  governingBody: "",
  introParagraph: "",
  heroImageSrc: "",
  heroImageAlt: "",
  heroImageCaption: "",
  heroImageAuthor: "",
  heroImageLicense: "",
  heroImageSourceUrl: "",
  contactPhone: "",
  contactEmail: "",
  contactAddress: "",
};

type FormState = typeof INITIAL_FORM;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

const inputCls = "border border-[var(--line-soft)] bg-[var(--paper)] px-2 py-1.5";

export default function ContributeForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [references, setReferences] = useState<ReferenceRow[]>([
    { ...EMPTY_REFERENCE },
    { ...EMPTY_REFERENCE },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ slug: string } | null>(null);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateReference(index: number, key: keyof ReferenceRow, value: string) {
    setReferences((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  function addReference() {
    setReferences((rows) => [...rows, { ...EMPTY_REFERENCE }]);
  }

  function removeReference(index: number) {
    setReferences((rows) => (rows.length <= 2 ? rows : rows.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const payload = {
        ...form,
        locationLat: Number(form.locationLat),
        locationLng: Number(form.locationLng),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        references: references.filter((r) => r.title.trim()),
      };
      const res = await fetch("/api/temples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fieldErrors: Record<string, string> = {};
        for (const err of data.errors ?? []) fieldErrors[err.field] = err.message;
        setErrors(fieldErrors);
        return;
      }
      setResult({ slug: data.slug });
    } catch (error) {
      setErrors({ _network: "Failed to submit. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="border border-[var(--line-soft)] bg-[var(--accent-soft)] p-4">
        <p className="font-semibold">Submitted as a draft — pending review.</p>
        <p className="ui mt-2 text-sm">
          <a href={`/temple/${result.slug}`}>View the new entry</a> ·{" "}
          <a href="/status">See it on the status dashboard</a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ui mt-6 flex flex-col gap-6">
      {errors._network && <p className="text-sm text-red-700">{errors._network}</p>}

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Basics</legend>
        <Field label="Temple name" error={errors.name}>
          <input className={inputCls} value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </Field>
        <Field label="Subtitle (location · presiding deity)" error={errors.subtitle}>
          <input className={inputCls} value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Presiding deity" error={errors.deityPresiding}>
            <input className={inputCls} value={form.deityPresiding} onChange={(e) => update("deityPresiding", e.target.value)} required />
          </Field>
          <Field label="Consort (optional)">
            <input className={inputCls} value={form.deityConsort} onChange={(e) => update("deityConsort", e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Location</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="City" error={errors.locationCity}>
            <input className={inputCls} value={form.locationCity} onChange={(e) => update("locationCity", e.target.value)} required />
          </Field>
          <Field label="District (optional)">
            <input className={inputCls} value={form.locationDistrict} onChange={(e) => update("locationDistrict", e.target.value)} />
          </Field>
          <Field label="State" error={errors.locationState}>
            <input className={inputCls} value={form.locationState} onChange={(e) => update("locationState", e.target.value)} required />
          </Field>
          <Field label="Country" error={errors.locationCountry}>
            <input className={inputCls} value={form.locationCountry} onChange={(e) => update("locationCountry", e.target.value)} required />
          </Field>
          <Field label="Address (optional)">
            <input className={inputCls} value={form.locationAddress} onChange={(e) => update("locationAddress", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" error={errors.locationLat}>
              <input className={inputCls} inputMode="decimal" value={form.locationLat} onChange={(e) => update("locationLat", e.target.value)} required />
            </Field>
            <Field label="Longitude" error={errors.locationLng}>
              <input className={inputCls} inputMode="decimal" value={form.locationLng} onChange={(e) => update("locationLng", e.target.value)} required />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Classification</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Temple type" error={errors.templeType}>
            <input className={inputCls} value={form.templeType} onChange={(e) => update("templeType", e.target.value)} required />
          </Field>
          <Field label="Tradition" error={errors.tradition}>
            <input className={inputCls} value={form.tradition} onChange={(e) => update("tradition", e.target.value)} required />
          </Field>
          <Field label="Architectural style" error={errors.architecturalStyle}>
            <input className={inputCls} value={form.architecturalStyle} onChange={(e) => update("architecturalStyle", e.target.value)} required />
          </Field>
          <Field label="Tags (comma-separated, optional)">
            <input className={inputCls} value={form.tags} onChange={(e) => update("tags", e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">History &amp; administration</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Established period" error={errors.establishedPeriod}>
            <input className={inputCls} value={form.establishedPeriod} onChange={(e) => update("establishedPeriod", e.target.value)} required />
          </Field>
          <Field label="Established year note" error={errors.establishedYearText}>
            <input className={inputCls} value={form.establishedYearText} onChange={(e) => update("establishedYearText", e.target.value)} required />
          </Field>
        </div>
        <Field label="Governing body" error={errors.governingBody}>
          <input className={inputCls} value={form.governingBody} onChange={(e) => update("governingBody", e.target.value)} required />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Introduction</legend>
        <Field label="Introduction paragraph" error={errors.introParagraph}>
          <textarea
            className={inputCls}
            rows={4}
            value={form.introParagraph}
            onChange={(e) => update("introParagraph", e.target.value)}
            required
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Hero image (Commons-style credit required)</legend>
        <Field label="Image URL" error={errors.heroImageSrc}>
          <input className={inputCls} value={form.heroImageSrc} onChange={(e) => update("heroImageSrc", e.target.value)} required />
        </Field>
        <Field label="Alt text" error={errors.heroImageAlt}>
          <input className={inputCls} value={form.heroImageAlt} onChange={(e) => update("heroImageAlt", e.target.value)} required />
        </Field>
        <Field label="Caption (optional)">
          <input className={inputCls} value={form.heroImageCaption} onChange={(e) => update("heroImageCaption", e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Author / credit" error={errors.heroImageAuthor}>
            <input className={inputCls} value={form.heroImageAuthor} onChange={(e) => update("heroImageAuthor", e.target.value)} required />
          </Field>
          <Field label="License" error={errors.heroImageLicense}>
            <input className={inputCls} value={form.heroImageLicense} onChange={(e) => update("heroImageLicense", e.target.value)} required />
          </Field>
          <Field label="Source URL" error={errors.heroImageSourceUrl}>
            <input className={inputCls} value={form.heroImageSourceUrl} onChange={(e) => update("heroImageSourceUrl", e.target.value)} required />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Contact</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Phone (optional)">
            <input className={inputCls} value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} />
          </Field>
          <Field label="Email (optional)">
            <input className={inputCls} value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
          </Field>
        </div>
        <Field label="Address" error={errors.contactAddress}>
          <input className={inputCls} value={form.contactAddress} onChange={(e) => update("contactAddress", e.target.value)} required />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">References (minimum 2)</legend>
        {errors.references && <p className="text-xs text-red-700">{errors.references}</p>}
        {references.map((ref, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 border border-[var(--line-soft)] p-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
            <input
              className={inputCls}
              placeholder="Title"
              value={ref.title}
              onChange={(e) => updateReference(i, "title", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="URL"
              value={ref.url}
              onChange={(e) => updateReference(i, "url", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Publisher (optional)"
              value={ref.publisher}
              onChange={(e) => updateReference(i, "publisher", e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeReference(i)}
              disabled={references.length <= 2}
              className="ui text-xs text-red-700 underline disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addReference} className="ui self-start text-sm underline">
          + Add another reference
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="ui self-start bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit temple as draft"}
      </button>
    </form>
  );
}
