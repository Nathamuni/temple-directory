import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Contributor and admin login for the Temple Directory.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-[420px] px-4 py-10">
      <h1 className="text-2xl">Log in</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Use a contributor or admin account to submit and manage temple entries.
      </p>
      <LoginForm next={next ?? "/contribute"} />
    </div>
  );
}
