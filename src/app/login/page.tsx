import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log in — Temple Directory" };

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Incorrect username or password.",
  pending: "Your contributor access request is still awaiting admin approval.",
  denied: "Your contributor access request was denied.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; denyReason?: string }>;
}) {
  const { error, next, denyReason } = await searchParams;

  return (
    <div className="mx-auto max-w-[420px] px-4 py-14">
      <h1 className="text-2xl">Contributor / Admin Log In</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Prototype-stage accounts only — not the eventual Google Sign-In / Phone OTP flow.
      </p>

      {error && (
        <p className="ui mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.invalid}
          {error === "denied" && denyReason && <> Reason: {denyReason}</>}
        </p>
      )}

      <form method="POST" action="/api/auth/login" className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? "/contribute"} />
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

      <div className="ui mt-6 border border-[var(--line-soft)] bg-[var(--paper-soft)] px-3 py-2 text-xs text-[var(--ink-soft)]">
        Example accounts for testing:
        <br />
        Contributor — <code>contributor</code> / <code>TempleVolunteer#2026</code>
        <br />
        Admin — <code>admin</code> / <code>TempleAdmin#2026</code>
      </div>

      <p className="ui mt-6 text-center text-sm">
        Don&apos;t have an account?{" "}
        <a href="/request-access" className="underline">
          Request contributor access
        </a>
      </p>
    </div>
  );
}
