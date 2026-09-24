import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Field, Notice, inputCls } from "@/components/account/ui";
import { requireViewer } from "@/lib/authz";
import { CORRECTION_SECTIONS } from "@/lib/store/corrections";
import { getTemple } from "@/lib/temples";

export const metadata: Metadata = { title: "Suggest a correction" };

export default async function SuggestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; section?: string }>;
}) {
  const { slug } = await params;
  await requireViewer(`/temple/${slug}/suggest`);
  const temple = getTemple(slug);
  if (!temple || temple.status !== "published") notFound();
  const { error, section } = await searchParams;

  return (
    <div className="mx-auto max-w-[560px] px-4 py-14">
      <h1 className="text-2xl">Suggest a correction</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        For <strong>{temple.identity.nameEn}</strong>. An editor reviews every suggestion before
        anything on the page changes; you&apos;ll see the outcome on your account page.
      </p>
      {error && <Notice tone="error">{error}</Notice>}

      <form method="POST" action={`/api/temples/${slug}/corrections`} className="mt-6 space-y-5">
        <Field label="Is this a correction or a current observation?" htmlFor="kind">
          <select id="kind" name="kind" className={inputCls} defaultValue="correction">
            <option value="correction">Correction — something on the page is wrong</option>
            <option value="observation">Observation — what I saw on my visit</option>
          </select>
        </Field>
        <Field label="Which part of the page? *" htmlFor="section">
          <select id="section" name="section" required className={inputCls} defaultValue={section ?? ""}>
            <option value="" disabled>Choose…</option>
            {CORRECTION_SECTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="What should it say? *" hint="Be specific — e.g. “Evening darshan now opens at 4:30 PM, not 4:00 PM.”" htmlFor="message">
          <textarea id="message" name="message" required minLength={10} maxLength={2000} rows={5} className={inputCls} />
        </Field>
        <Field label="Source link (optional)" hint="Official website, notice-board photo link, news report…" htmlFor="sourceUrl">
          <input id="sourceUrl" name="sourceUrl" type="url" className={inputCls} placeholder="https://" />
        </Field>
        <button type="submit" className="ui bg-[var(--accent)] px-4 py-2 font-semibold text-white">
          Send to editors
        </button>
      </form>
    </div>
  );
}
