import type { Metadata } from "next";

export const metadata: Metadata = { title: "Request Contributor Access — Temple Directory" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="ui block text-sm font-semibold">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls = "w-full border border-[var(--line-soft)] px-3 py-2";

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { error, submitted } = await searchParams;

  return (
    <div className="mx-auto max-w-[480px] px-4 py-14">
      <h1 className="text-2xl">Request Contributor Access</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Contributor accounts aren&apos;t self-activating — an admin reviews every request before
        you can log in and submit temples. You&apos;ll be notified only by checking back here or
        trying to log in; there&apos;s no email step in this prototype.
      </p>

      {submitted && (
        <p className="ui mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Request submitted. An admin will review it — try logging in afterwards with the username
          and password you chose.
        </p>
      )}
      {error && (
        <p className="ui mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {!submitted && (
        <form method="POST" action="/api/auth/request-access" className="mt-6 space-y-5">
          <Field label="Full name *">
            <input name="name" required minLength={2} className={inputCls} autoComplete="name" />
          </Field>
          <Field label="Phone number *">
            <input name="phone" type="tel" required minLength={7} className={inputCls} autoComplete="tel" />
          </Field>
          <Field label="Email *">
            <input name="email" type="email" required className={inputCls} autoComplete="email" />
          </Field>
          <Field label="Username *">
            <input name="username" required minLength={3} className={inputCls} autoComplete="username" />
          </Field>
          <Field label="Password *">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className={inputCls}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password *">
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className={inputCls}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Why do you want to contribute?">
            <textarea
              name="reason"
              rows={3}
              className={inputCls}
              placeholder="Optional — e.g. temples you know well, sources you can cite"
            />
          </Field>
          <button type="submit" className="ui bg-[var(--accent)] px-4 py-2 font-semibold text-white">
            Submit request
          </button>
        </form>
      )}
    </div>
  );
}
