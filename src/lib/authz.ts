import { redirect } from "next/navigation";
import { getSession } from "./session";
import { getUser, grantsForUser, type RoleGrant, type User } from "./store/accounts";
import type { GrantRole } from "./roles";

/**
 * Who is looking at this request, and what they are currently allowed to do.
 *
 * Built fresh on every request from the account store, never from the cookie,
 * so suspending an account or revoking a role bites immediately.
 */
export interface Viewer {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  /** Approved grants only. */
  grants: RoleGrant[];
}

export function viewerFor(user: User | undefined): Viewer | null {
  if (!user || user.status !== "active") return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    isAdmin: Boolean(user.isAdmin),
    grants: grantsForUser(user.id).filter((g) => g.status === "approved"),
  };
}

export async function getViewer(): Promise<Viewer | null> {
  const session = await getSession();
  return session ? viewerFor(getUser(session.uid)) : null;
}

/**
 * Does the viewer hold `role`? For a temple-scoped role pass `templeSlug`
 * to ask about one temple specifically; omit it to ask "for any temple".
 * Admin is not a superset here — an admin is not a priest.
 */
export function hasRole(viewer: Viewer | null, role: GrantRole, templeSlug?: string): boolean {
  if (!viewer) return false;
  return viewer.grants.some(
    (g) => g.role === role && (templeSlug === undefined || g.templeSlug === templeSlug)
  );
}

/** Temple slugs the viewer holds `role` for. */
export function templesFor(viewer: Viewer | null, role: GrantRole): string[] {
  if (!viewer) return [];
  return viewer.grants.filter((g) => g.role === role && g.templeSlug).map((g) => g.templeSlug!);
}

/** Pages: send anonymous visitors to log in and come back. */
export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}

/** Pages: admins only; anyone else logged in goes to their account. */
export async function requireAdmin(next: string): Promise<Viewer> {
  const viewer = await requireViewer(next);
  if (!viewer.isAdmin) redirect("/account");
  return viewer;
}

/**
 * Where to send someone after login. Only same-site paths — `//host` and
 * absolute URLs would turn the login form into an open redirect.
 */
export function safeNext(value: unknown, fallback = "/account"): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
