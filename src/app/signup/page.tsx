import type { Metadata } from "next";
import Link from "next/link";
import { Field, Notice, inputCls } from "@/components/account/ui";
import { safeNext } from "@/lib/authz";
import { ROLE_LABEL, isGrantRole } from "@/lib/roles";

export const metadata: Metadata = { title: "Create an account — Temple Directory" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // Arriving from "Sign up as…" on /login: next is /apply/<role>.
  const chosen = safeNext(next).match(/^\/apply\/([a-z_]+)/)?.[1];
  const role = chosen && isGrantRole(chosen) ? chosen : undefined;

  return (
    <div className="mx-auto max-w-[480px] px-4 py-14">
      <h1 className="text-2xl">Create your account</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        One account for everything. You can follow temples and suggest corrections straight away;
        contributor, temple-management, priest and seva-coordinator roles are applied for from your
        account page and approved by an admin.
      </p>

      {role && (
        <Notice tone="info">
          Signing up as <strong>{ROLE_LABEL[role]}</strong> — step 1 of 2. After creating your
          account you&apos;ll fill in the {ROLE_LABEL[role]} application for admin approval.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <form method="POST" action="/api/auth/signup" className="mt-6 space-y-5">
        <input type="hidden" name="next" value={safeNext(next)} />
        <Field label="Full name *" htmlFor="name">
          <input id="name" name="name" required minLength={2} className={inputCls} autoComplete="name" />
        </Field>
        <Field label="Mobile number *" htmlFor="phone">
          <input id="phone" name="phone" type="tel" required minLength={7} className={inputCls} autoComplete="tel" />
        </Field>
        <Field label="Email *" htmlFor="email">
          <input id="email" name="email" type="email" required className={inputCls} autoComplete="email" />
        </Field>
        <Field label="City (optional)" htmlFor="city">
          <input id="city" name="city" className={inputCls} autoComplete="address-level2" />
        </Field>
        <Field label="Preferred language (optional)" htmlFor="language">
          <input id="language" name="language" className={inputCls} placeholder="Tamil, Hindi, English…" />
        </Field>
        <Field label="Username *" hint="3–32 letters, numbers, dots, dashes or underscores." htmlFor="username">
          <input id="username" name="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._\-]+" className={inputCls} autoComplete="username" />
        </Field>
        <Field label="Password *" hint="At least 8 characters." htmlFor="password">
          <input id="password" name="password" type="password" required minLength={8} className={inputCls} autoComplete="new-password" />
        </Field>
        <Field label="Confirm password *" htmlFor="confirmPassword">
          <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} className={inputCls} autoComplete="new-password" />
        </Field>
        <button type="submit" className="ui bg-[var(--accent)] px-4 py-2 font-semibold text-white">
          Create account
        </button>
      </form>

      <p className="ui mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(safeNext(next))}`} className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
