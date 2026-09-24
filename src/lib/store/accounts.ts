import fs from "fs";
import { REQUESTS_FILE, ensureDataDir } from "../dataDir";
import { isTempleScoped, type GrantRole } from "../roles";
import { audit } from "./audit";
import { newId, readJson, updateJson } from "./jsonStore";
import { hashPassword, verifyPassword } from "./password";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type UserStatus = "active" | "suspended";

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  language?: string;
  /** Absent only on the built-in accounts, whose password lives in the environment. */
  passwordHash?: string;
  status: UserStatus;
  suspendedReason?: string;
  createdAt: string;
  isAdmin?: boolean;
}

export type GrantStatus = "applied" | "approved" | "rejected" | "revoked";

export interface RoleGrant {
  id: string;
  userId: string;
  role: GrantRole;
  /** Required for temple-scoped roles, null for contributor. */
  templeSlug: string | null;
  status: GrantStatus;
  application: Record<string, string>;
  appliedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Why it was rejected or revoked. Shown to the applicant. */
  reason?: string;
}

const USERS = "users.json";
const GRANTS = "role-grants.json";

/* ------------------------------------------------------------------ *
 * Built-in accounts
 *
 * Passwords come from the environment so the repository never carries a
 * working credential. Local development falls back to the documented
 * prototype values; production refuses to start without its own.
 * ------------------------------------------------------------------ */

const DEV_ADMIN_PASSWORD = "TempleAdmin#2026";
const DEV_CONTRIBUTOR_PASSWORD = "TempleVolunteer#2026";

function builtInPassword(envVar: string, devFallback: string): string {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${envVar} is not set. A production deploy must set its own passwords — ` +
        `the development defaults are published in this repository.`
    );
  }
  return devFallback;
}

const EPOCH = "2026-01-01T00:00:00.000Z";

interface BuiltIn {
  user: User;
  password: () => string;
  grants: RoleGrant[];
}

function builtIns(): BuiltIn[] {
  const admin: User = {
    id: "builtin:admin",
    username: process.env.ADMIN_USERNAME || "admin",
    name: "Platform Admin",
    email: "",
    phone: "",
    status: "active",
    createdAt: EPOCH,
    isAdmin: true,
  };
  const contributor: User = {
    id: "builtin:contributor",
    username: "contributor",
    name: "Shared contributor account",
    email: "",
    phone: "",
    status: "active",
    createdAt: EPOCH,
  };
  return [
    { user: admin, password: () => builtInPassword("ADMIN_PASSWORD", DEV_ADMIN_PASSWORD), grants: [] },
    {
      user: contributor,
      password: () => builtInPassword("CONTRIBUTOR_PASSWORD", DEV_CONTRIBUTOR_PASSWORD),
      grants: [
        {
          id: "builtin:contributor:grant",
          userId: contributor.id,
          role: "contributor",
          templeSlug: null,
          status: "approved",
          application: {},
          appliedAt: EPOCH,
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Legacy migration
 *
 * contributor-requests.json held plaintext passwords. On first use each row
 * becomes a hashed User plus a contributor grant with the equivalent status,
 * and the file is rewritten without any password. Running it again is a no-op.
 * ------------------------------------------------------------------ */

interface LegacyRequest {
  username: string;
  password?: string;
  name: string;
  phone: string;
  email: string;
  reason?: string;
  status: "pending" | "approved" | "denied";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  denyReason?: string;
  migratedTo?: string;
}

let migrated = false;

export function migrateLegacyRequests(): number {
  ensureDataDir();
  if (!fs.existsSync(REQUESTS_FILE)) return 0;
  const legacy = JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8")) as LegacyRequest[];
  const todo = legacy.filter((r) => r.password !== undefined);
  if (todo.length === 0) return 0;

  const users = readJson<User[]>(USERS, []);
  const grants = readJson<RoleGrant[]>(GRANTS, []);
  for (const request of todo) {
    let user = users.find((u) => u.username.toLowerCase() === request.username.toLowerCase());
    if (!user) {
      user = {
        id: newId("usr"),
        username: request.username,
        name: request.name,
        email: request.email,
        phone: request.phone,
        passwordHash: hashPassword(request.password!),
        status: "active",
        createdAt: request.requestedAt,
      };
      users.push(user);
      grants.push({
        id: newId("grt"),
        userId: user.id,
        role: "contributor",
        templeSlug: null,
        status: request.status === "pending" ? "applied" : request.status === "approved" ? "approved" : "rejected",
        application: request.reason ? { motivation: request.reason } : {},
        appliedAt: request.requestedAt,
        reviewedBy: request.reviewedBy,
        reviewedAt: request.reviewedAt,
        reason: request.denyReason,
      });
    }
    delete request.password;
    request.migratedTo = user.id;
  }
  updateJson<User[]>(USERS, [], () => users);
  updateJson<RoleGrant[]>(GRANTS, [], () => grants);
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(legacy, null, 2) + "\n", "utf8");
  return todo.length;
}

function ready(): void {
  if (migrated) return;
  migrated = true;
  migrateLegacyRequests();
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

function storedUsers(): User[] {
  ready();
  return readJson<User[]>(USERS, []);
}

export function listUsers(): User[] {
  return [...builtIns().map((b) => b.user), ...storedUsers()];
}

export function getUser(id: string): User | undefined {
  return listUsers().find((u) => u.id === id);
}

export function findUserByUsername(username: string): User | undefined {
  const wanted = username.trim().toLowerCase();
  return listUsers().find((u) => u.username.toLowerCase() === wanted);
}

export function usernameTaken(username: string): boolean {
  return Boolean(findUserByUsername(username));
}

export interface SignupInput {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  language?: string;
}

/** Validation shared by the signup route and tests. Returns an error message or null. */
export function signupProblem(input: SignupInput & { confirmPassword?: string }): string | null {
  if (input.name.trim().length < 2) return "Full name is required.";
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(input.username)) {
    return "Username must be 3–32 letters, numbers, dots, dashes or underscores.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return "A valid email address is required.";
  if (input.phone.replace(/\D/g, "").length < 7) return "A valid phone number is required.";
  if (input.password.length < 8) return "Password must be at least 8 characters.";
  if (input.confirmPassword !== undefined && input.password !== input.confirmPassword) {
    return "Passwords do not match.";
  }
  if (usernameTaken(input.username)) return `Username "${input.username}" is already taken.`;
  return null;
}

/** Self-service signup: an active devotee account, no approval needed. */
export function createUser(input: SignupInput): User {
  const problem = signupProblem(input);
  if (problem) throw new Error(problem);
  const user: User = {
    id: newId("usr"),
    username: input.username.trim(),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    city: input.city?.trim() || undefined,
    language: input.language?.trim() || undefined,
    passwordHash: hashPassword(input.password),
    status: "active",
    createdAt: new Date().toISOString(),
  };
  updateJson<User[]>(USERS, [], (users) => [...users, user]);
  return user;
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "suspended"; detail?: string };

export function checkLogin(username: string, password: string): LoginResult {
  const builtIn = builtIns().find((b) => b.user.username === username);
  if (builtIn) {
    return builtIn.password() === password ? { ok: true, user: builtIn.user } : { ok: false, reason: "invalid" };
  }
  const user = storedUsers().find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) return { ok: false, reason: "invalid" };
  if (user.status === "suspended") return { ok: false, reason: "suspended", detail: user.suspendedReason };
  return { ok: true, user };
}

export function setUserStatus(userId: string, status: UserStatus, actor: string, reason?: string): User {
  if (userId.startsWith("builtin:")) throw new Error("Built-in accounts are managed through the environment.");
  if (status === "suspended" && !reason?.trim()) throw new Error("A reason is required to suspend an account.");
  let changed: User | undefined;
  updateJson<User[]>(USERS, [], (users) =>
    users.map((u) => {
      if (u.id !== userId) return u;
      changed = { ...u, status, suspendedReason: status === "suspended" ? reason!.trim() : undefined };
      return changed;
    })
  );
  if (!changed) throw new Error("No such account.");
  audit({ actor, action: status === "suspended" ? "user.suspend" : "user.reactivate", target: changed.username, detail: reason });
  return changed;
}

/* ------------------------------------------------------------------ *
 * Role grants
 * ------------------------------------------------------------------ */

export function listGrants(): RoleGrant[] {
  ready();
  return [...builtIns().flatMap((b) => b.grants), ...readJson<RoleGrant[]>(GRANTS, [])];
}

export function grantsForUser(userId: string): RoleGrant[] {
  return listGrants().filter((g) => g.userId === userId);
}

export function pendingGrantCount(): number {
  return listGrants().filter((g) => g.status === "applied").length;
}

export function applyForRole(
  userId: string,
  role: GrantRole,
  templeSlug: string | null,
  application: Record<string, string>
): RoleGrant {
  if (userId.startsWith("builtin:")) throw new Error("Built-in accounts cannot apply for roles.");
  if (isTempleScoped(role) && !templeSlug) throw new Error("Choose the temple this role is for.");
  const scope = isTempleScoped(role) ? templeSlug : null;
  const open = grantsForUser(userId).find(
    (g) => g.role === role && g.templeSlug === scope && (g.status === "applied" || g.status === "approved")
  );
  if (open) {
    throw new Error(open.status === "approved" ? "You already hold this role." : "You already have an application waiting for review.");
  }
  const grant: RoleGrant = {
    id: newId("grt"),
    userId,
    role,
    templeSlug: scope,
    status: "applied",
    application,
    appliedAt: new Date().toISOString(),
  };
  updateJson<RoleGrant[]>(GRANTS, [], (grants) => [...grants, grant]);
  return grant;
}

function changeGrant(id: string, change: (g: RoleGrant) => RoleGrant): RoleGrant {
  if (id.startsWith("builtin:")) throw new Error("Built-in grants cannot be changed.");
  let changed: RoleGrant | undefined;
  updateJson<RoleGrant[]>(GRANTS, [], (grants) =>
    grants.map((g) => {
      if (g.id !== id) return g;
      changed = change(g);
      return changed;
    })
  );
  if (!changed) throw new Error("No such application.");
  return changed;
}

/** Admin decision on an application. Rejecting requires a reason. */
export function reviewGrant(id: string, decision: "approved" | "rejected", actor: string, reason?: string): RoleGrant {
  if (decision === "rejected" && !reason?.trim()) throw new Error("A reason is required to reject an application.");
  const grant = changeGrant(id, (g) => {
    if (g.status !== "applied") throw new Error(`This application was already ${g.status}.`);
    return {
      ...g,
      status: decision,
      reviewedBy: actor,
      reviewedAt: new Date().toISOString(),
      reason: decision === "rejected" ? reason!.trim() : undefined,
    };
  });
  audit({ actor, action: `grant.${decision}`, target: grant.id, detail: `${grant.role}${grant.templeSlug ? `@${grant.templeSlug}` : ""}` });
  return grant;
}

export function revokeGrant(id: string, actor: string, reason: string): RoleGrant {
  if (!reason.trim()) throw new Error("A reason is required to revoke a role.");
  const grant = changeGrant(id, (g) => {
    if (g.status !== "approved") throw new Error(`Only an approved role can be revoked (this one is ${g.status}).`);
    return { ...g, status: "revoked", reviewedBy: actor, reviewedAt: new Date().toISOString(), reason: reason.trim() };
  });
  audit({ actor, action: "grant.revoke", target: grant.id, detail: `${grant.role}${grant.templeSlug ? `@${grant.templeSlug}` : ""}: ${reason}` });
  return grant;
}
