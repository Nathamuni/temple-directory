import type { Metadata } from "next";
import { safeNext } from "@/lib/authz";
import { GRANT_ROLES, ROLE_LABEL, ROLE_PURPOSE, isTempleScoped } from "@/lib/roles";

export const metadata: Metadata = { title: "Log in — Temple Directory" };

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Incorrect username or password.",
  suspended: "This account has been suspended.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; detail?: string }>;
}) {
  const { error, next, detail } = await searchParams;

  return (
    <div className="mx-auto max-w-[420px] px-4 py-14">
      <h1 className="text-2xl">Log in</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        One login for devotees, contributors, temple management, priests, seva coordinators and
        admins — what you can do depends on the roles approved on your account.
      </p>

      {error && (
        <p className="ui mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.invalid}
          {error === "suspended" && detail && <> Reason: {detail}</>}
        </p>
      )}

      <form method="POST" action="/api/auth/login" className="mt-6 space-y-4">
        <input type="hidden" name="next" value={safeNext(next)} />
        <div>
          <label className="ui block text-sm font-semibold" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            required
            autoComplete="username"
            className="mt-1 w-full border border-[var(--line-soft)] px-3 py-2"
          />
        </div>
        <div>
          <label className="ui block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full border border-[var(--line-soft)] px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="ui w-full bg-[var(--accent)] px-3 py-2 font-semibold text-white"
        >
          Log in
        </button>
      </form>

      {process.env.NODE_ENV !== "production" && (
      <div className="ui mt-6 border border-[var(--line-soft)] bg-[var(--paper-soft)] px-3 py-2 text-xs text-[var(--ink-soft)]">
        Development accounts (hidden in production):
        <br />
        Contributor — <code>contributor</code> / <code>TempleVolunteer#2026</code>
        <br />
        Admin — <code>admin</code> / <code>TempleAdmin#2026</code>
      </div>
      )}

      <section className="mt-8 border-t border-[var(--line-soft)] pt-6" aria-labelledby="signup-as">
        <h2 id="signup-as" className="text-lg">New here? Sign up as…</h2>
        <p className="ui mt-1 text-xs text-[var(--ink-soft)]">
          Every account can follow temples and suggest corrections. The other roles are applied for
          right after signup and start working once an admin approves them.
        </p>
        <ul className="m-0 mt-3 grid list-none gap-2 p-0">
          <li>
            <a
              href={`/signup?next=${encodeURIComponent(safeNext(next))}`}
              className="ui block rounded-lg border border-[var(--line-soft)] bg-[var(--paper-soft)] px-3 py-2.5 text-sm hover:no-underline"
            >
              <strong>{ROLE_LABEL.devotee}</strong>
              <span className="block text-xs text-[var(--ink-soft)]">Follow temples, suggest corrections. No approval needed.</span>
            </a>
          </li>
          {GRANT_ROLES.map((role) => (
            <li key={role}>
              <a
                href={`/signup?next=${encodeURIComponent(`/apply/${role}`)}`}
                className="ui block rounded-lg border border-[var(--line-soft)] bg-[var(--paper-soft)] px-3 py-2.5 text-sm hover:no-underline"
              >
                <strong>{ROLE_LABEL[role]}</strong>
                <span className="block text-xs text-[var(--ink-soft)]">
                  {ROLE_PURPOSE[role]} Needs admin approval
                  {isTempleScoped(role) ? " · for one temple" : ""}.
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
