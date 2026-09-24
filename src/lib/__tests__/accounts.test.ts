import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { useTempDataDir } from "./helpers";

const dir = useTempDataDir();
const { hashPassword, verifyPassword } = await import("../store/password");
const accounts = await import("../store/accounts");
const { viewerFor, hasRole, templesFor, safeNext } = await import("../authz");

function signup(username: string) {
  return accounts.createUser({
    username,
    password: "correct horse battery",
    name: `${username} Test`,
    email: `${username}@example.org`,
    phone: "+91 98400 00000",
  });
}

describe("password hashing", () => {
  it("verifies the right password and rejects others", () => {
    const stored = hashPassword("TempleSeva#1");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("TempleSeva#1");
    expect(verifyPassword("TempleSeva#1", stored)).toBe(true);
    expect(verifyPassword("templeseva#1", stored)).toBe(false);
    expect(verifyPassword("TempleSeva#1", undefined)).toBe(false);
    expect(verifyPassword("TempleSeva#1", "plain-text")).toBe(false);
  });

  it("salts every hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
});

describe("legacy contributor-request migration", () => {
  beforeAll(() => {
    const legacy = [
      { username: "meena", password: "LegacyPass#1", name: "Meena", phone: "9840000001", email: "m@example.org", status: "approved", requestedAt: "2026-09-01T00:00:00.000Z", reviewedBy: "admin" },
      { username: "ravi", password: "LegacyPass#2", name: "Ravi", phone: "9840000002", email: "r@example.org", status: "pending", requestedAt: "2026-09-02T00:00:00.000Z" },
      { username: "arun", password: "LegacyPass#3", name: "Arun", phone: "9840000003", email: "a@example.org", status: "denied", denyReason: "No sources", requestedAt: "2026-09-03T00:00:00.000Z" },
    ];
    fs.writeFileSync(path.join(dir, "contributor-requests.json"), JSON.stringify(legacy));
  });

  it("moves every request into hashed accounts and leaves no plaintext behind", () => {
    expect(accounts.migrateLegacyRequests()).toBe(3);
    const raw = fs.readFileSync(path.join(dir, "contributor-requests.json"), "utf8");
    expect(raw).not.toMatch(/LegacyPass/);
    const usersRaw = fs.readFileSync(path.join(dir, "app", "users.json"), "utf8");
    expect(usersRaw).not.toMatch(/LegacyPass/);
  });

  it("is idempotent", () => {
    expect(accounts.migrateLegacyRequests()).toBe(0);
    expect(accounts.listUsers().filter((u) => u.username === "meena")).toHaveLength(1);
  });

  it("keeps each request's outcome as a contributor grant", () => {
    const status = (u: string) => accounts.grantsForUser(accounts.findUserByUsername(u)!.id)[0].status;
    expect(status("meena")).toBe("approved");
    expect(status("ravi")).toBe("applied");
    expect(status("arun")).toBe("rejected");
    const login = accounts.checkLogin("meena", "LegacyPass#1");
    expect(login.ok).toBe(true);
    expect(hasRole(viewerFor(login.ok ? login.user : undefined), "contributor")).toBe(true);
  });
});

describe("signup and login", () => {
  it("creates an active devotee with no roles", () => {
    const user = signup("devotee1");
    const viewer = viewerFor(user)!;
    expect(viewer.grants).toHaveLength(0);
    expect(viewer.isAdmin).toBe(false);
    expect(accounts.checkLogin("devotee1", "correct horse battery").ok).toBe(true);
    expect(accounts.checkLogin("DEVOTEE1", "correct horse battery").ok).toBe(true);
    expect(accounts.checkLogin("devotee1", "wrong").ok).toBe(false);
  });

  it("rejects duplicate usernames case-insensitively and weak input", () => {
    expect(() => signup("Devotee1")).toThrow(/already taken/);
    expect(accounts.signupProblem({ username: "ab", password: "12345678", name: "X Y", email: "a@b.co", phone: "9840000000" })).toMatch(/Username/);
    expect(accounts.signupProblem({ username: "abc", password: "short", name: "X Y", email: "a@b.co", phone: "9840000000" })).toMatch(/8 characters/);
    expect(accounts.signupProblem({ username: "admin", password: "12345678", name: "X Y", email: "a@b.co", phone: "9840000000" })).toMatch(/taken/);
  });

  it("blocks a suspended account from logging in and from every role", () => {
    const user = signup("suspendme");
    const grant = accounts.applyForRole(user.id, "contributor", null, {});
    accounts.reviewGrant(grant.id, "approved", "admin");
    accounts.setUserStatus(user.id, "suspended", "admin", "spam");
    const login = accounts.checkLogin("suspendme", "correct horse battery");
    expect(login).toMatchObject({ ok: false, reason: "suspended", detail: "spam" });
    expect(viewerFor(accounts.getUser(user.id))).toBeNull();
    accounts.setUserStatus(user.id, "active", "admin");
    expect(hasRole(viewerFor(accounts.getUser(user.id)), "contributor")).toBe(true);
  });
});

describe("role grants", () => {
  it("gives nothing until an admin approves", () => {
    const user = signup("applicant");
    accounts.applyForRole(user.id, "contributor", null, { motivation: "x" });
    expect(hasRole(viewerFor(user), "contributor")).toBe(false);
    expect(() => accounts.applyForRole(user.id, "contributor", null, {})).toThrow(/waiting/);
  });

  it("scopes temple roles to one temple", () => {
    const user = signup("priest1");
    const grant = accounts.applyForRole(user.id, "priest", "srirangam-ranganathaswamy", {});
    expect(() => accounts.applyForRole(user.id, "priest", null, {})).toThrow(/temple/);
    accounts.reviewGrant(grant.id, "approved", "admin");
    const viewer = viewerFor(user);
    expect(hasRole(viewer, "priest", "srirangam-ranganathaswamy")).toBe(true);
    expect(hasRole(viewer, "priest", "madurai-meenakshi")).toBe(false);
    expect(hasRole(viewer, "temple_management", "srirangam-ranganathaswamy")).toBe(false);
    expect(templesFor(viewer, "priest")).toEqual(["srirangam-ranganathaswamy"]);
  });

  it("requires a reason to reject or revoke, and revocation bites on the next request", () => {
    const user = signup("revokee");
    const grant = accounts.applyForRole(user.id, "contributor", null, {});
    expect(() => accounts.reviewGrant(grant.id, "rejected", "admin")).toThrow(/reason/);
    accounts.reviewGrant(grant.id, "approved", "admin");
    expect(() => accounts.reviewGrant(grant.id, "approved", "admin")).toThrow(/already/);
    expect(hasRole(viewerFor(user), "contributor")).toBe(true);
    expect(() => accounts.revokeGrant(grant.id, "admin", " ")).toThrow(/reason/);
    accounts.revokeGrant(grant.id, "admin", "left the project");
    expect(hasRole(viewerFor(user), "contributor")).toBe(false);
  });

  it("does not let admin count as any other role", () => {
    const admin = accounts.findUserByUsername("admin")!;
    const viewer = viewerFor(admin)!;
    expect(viewer.isAdmin).toBe(true);
    expect(hasRole(viewer, "contributor")).toBe(false);
  });
});

describe("safeNext", () => {
  it.each([
    ["/account", "/account"],
    ["/temple/x?y=1", "/temple/x?y=1"],
    ["//evil.example", "/account"],
    ["/\\evil.example", "/account"],
    ["https://evil.example", "/account"],
    ["javascript:alert(1)", "/account"],
    [undefined, "/account"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
