import fs from "fs";
import path from "path";
import type { Role } from "./session";

/**
 * Prototype-only example accounts — plaintext by design, not a leaked hash.
 * There is no user database; replace this with real auth (Google Sign-In /
 * Phone OTP, per the platform roadmap) before any public deployment.
 */
const USERS: { username: string; password: string; role: Role }[] = [
  { username: "admin", password: "TempleAdmin#2026", role: "admin" },
  { username: "contributor", password: "TempleVolunteer#2026", role: "contributor" },
];

export type RequestStatus = "pending" | "approved" | "denied";

export interface ContributorRequest {
  username: string;
  /** Plaintext, same prototype-only posture as USERS above. */
  password: string;
  name: string;
  phone: string;
  email: string;
  reason?: string;
  status: RequestStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  denyReason?: string;
}

const REQUESTS_FILE = path.join(process.cwd(), "data", "contributor-requests.json");

function loadRequests(): ContributorRequest[] {
  try {
    return JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8")) as ContributorRequest[];
  } catch {
    return [];
  }
}

function saveRequests(requests: ContributorRequest[]): void {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2) + "\n", "utf8");
}

export function getContributorRequests(): ContributorRequest[] {
  return loadRequests();
}

export function pendingRequestCount(): number {
  return loadRequests().filter((r) => r.status === "pending").length;
}

export function usernameTaken(username: string): boolean {
  if (USERS.some((u) => u.username === username)) return true;
  return loadRequests().some((r) => r.username === username);
}

/** A contributor asking for access — always starts "pending". */
export function submitContributorRequest(input: {
  username: string;
  password: string;
  name: string;
  phone: string;
  email: string;
  reason?: string;
}): void {
  const requests = loadRequests();
  requests.push({ ...input, status: "pending", requestedAt: new Date().toISOString() });
  saveRequests(requests);
}

/** Admin decision on a pending request. Denying requires a reason. */
export function reviewContributorRequest(
  username: string,
  decision: "approved" | "denied",
  reviewer: string,
  denyReason?: string
): ContributorRequest {
  const requests = loadRequests();
  const request = requests.find((r) => r.username === username);
  if (!request) throw new Error(`No request found for "${username}"`);
  if (request.status !== "pending") {
    throw new Error(`Request for "${username}" was already ${request.status}`);
  }
  if (decision === "denied" && !denyReason?.trim()) {
    throw new Error("A reason is required to deny a request");
  }
  request.status = decision;
  request.reviewedAt = new Date().toISOString();
  request.reviewedBy = reviewer;
  if (decision === "denied") request.denyReason = denyReason!.trim();
  saveRequests(requests);
  return request;
}

export type LoginResult =
  | { ok: true; role: Role }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "pending" }
  | { ok: false; reason: "denied"; denyReason?: string };

/**
 * Checks the hardcoded prototype accounts first, then approved contributor
 * requests. Distinguishes "wrong credentials" from "right credentials, but
 * your request isn't approved yet" so /login can show the right message.
 */
export function checkLogin(username: string, password: string): LoginResult {
  const hardcoded = USERS.find((u) => u.username === username && u.password === password);
  if (hardcoded) return { ok: true, role: hardcoded.role };

  const request = loadRequests().find((r) => r.username === username && r.password === password);
  if (!request) return { ok: false, reason: "invalid" };
  if (request.status === "approved") return { ok: true, role: "contributor" };
  if (request.status === "denied") return { ok: false, reason: "denied", denyReason: request.denyReason };
  return { ok: false, reason: "pending" };
}
