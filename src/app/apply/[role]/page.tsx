import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Field, Notice, inputCls } from "@/components/account/ui";
import { hasRole, requireViewer } from "@/lib/authz";
import { APPLICATION_FIELDS, ROLE_LABEL, ROLE_PURPOSE, isGrantRole, isTempleScoped } from "@/lib/roles";
import { getPublishedTemples } from "@/lib/temples";

export const metadata: Metadata = { title: "Apply for a role — Temple Directory" };

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ error?: string; temple?: string }>;
}) {
  const { role } = await params;
  if (!isGrantRole(role)) notFound();
  const viewer = await requireViewer(`/apply/${role}`);
  const { error, temple } = await searchParams;
  const scoped = isTempleScoped(role);
  const temples = scoped
    ? getPublishedTemples()
        .map((t) => ({ slug: t.slug, name: t.identity.nameEn, place: t.location.city }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  if (viewer.isAdmin) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-14">
        <Notice tone="info">Admin accounts review applications rather than holding roles.</Notice>
      </div>
    );
  }
  if (!scoped && hasRole(viewer, role)) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-14">
        <h1 className="text-2xl">{ROLE_LABEL[role]}</h1>
        <Notice tone="ok">You already hold this role.</Notice>
        <Link href="/account" className="ui underline">Back to your account</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-14">
      <h1 className="text-2xl">Apply: {ROLE_LABEL[role]}</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        {ROLE_PURPOSE[role]} An admin reviews every application; you&apos;ll see the decision on your
        account page.
      </p>

      {error && <Notice tone="error">{error}</Notice>}

      <form method="POST" action="/api/apply" className="mt-6 space-y-5">
        <input type="hidden" name="role" value={role} />
        {scoped && (
          <Field label="Temple *" hint="This role applies to one temple only." htmlFor="templeSlug">
            <select id="templeSlug" name="templeSlug" required defaultValue={temple ?? ""} className={inputCls}>
              <option value="" disabled>
                Choose a temple…
              </option>
              {temples.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                  {t.place ? ` — ${t.place}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        {APPLICATION_FIELDS[role].map((field) => (
          <Field key={field.name} label={`${field.label}${field.required ? " *" : ""}`} hint={field.hint} htmlFor={field.name}>
            {field.long ? (
              <textarea id={field.name} name={field.name} required={field.required} rows={3} className={inputCls} />
            ) : (
              <input id={field.name} name={field.name} required={field.required} className={inputCls} />
            )}
          </Field>
        ))}
        <button type="submit" className="ui bg-[var(--accent)] px-4 py-2 font-semibold text-white">
          Submit application
        </button>
      </form>
    </div>
  );
}
