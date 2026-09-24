import { describe, expect, it } from "vitest";
import { useTempDataDir } from "./helpers";

useTempDataDir();
const { getTemple, replacePublishedTemple } = await import("../temples");
const { proposeRevision, reviewRevision, RevisionError } = await import("../store/revisions");
const { changedAreas } = await import("../fieldAuthority");
const { readAudit } = await import("../store/audit");

const SLUG = "srirangam-ranganathaswamy";
const OTHER = "chidambaram-nataraja";

function edited(slug: string, change: (t: ReturnType<typeof getTemple> & object) => void) {
  const temple = structuredClone(getTemple(slug)!);
  change(temple);
  return temple;
}

function expectRefusal(fn: () => unknown, status: number, message: RegExp) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RevisionError);
    expect((error as InstanceType<typeof RevisionError>).status).toBe(status);
    expect((error as Error).message).toMatch(message);
    return;
  }
  throw new Error("expected a refusal");
}

describe("field authority", () => {
  it("detects exactly which areas changed", () => {
    const before = getTemple(SLUG)!;
    const after = edited(SLUG, (t) => {
      t.worshipSop[0].instruction = "Changed";
      t.identity.sampradayaAgama = "Pancharatra (test)";
    });
    expect(changedAreas(before, after).sort()).toEqual(["identity.sampradayaAgama", "worshipSop"]);
  });

  it("refuses a priest changing opening hours", () => {
    expectRefusal(
      () => proposeRevision({ templeSlug: SLUG, actingRole: "priest", submittedBy: "p1", proposed: edited(SLUG, (t) => { t.openingHours[0].sessionName = "X"; }) }),
      403,
      /Opening hours/
    );
  });

  it("refuses temple management changing the worship SOP", () => {
    expectRefusal(
      () => proposeRevision({ templeSlug: SLUG, actingRole: "temple_management", submittedBy: "tm1", proposed: edited(SLUG, (t) => { t.worshipSop[0].instruction = "X"; }) }),
      403,
      /Worship SOP/
    );
  });

  it("refuses an empty change and an unpublished temple", () => {
    expectRefusal(() => proposeRevision({ templeSlug: SLUG, actingRole: "priest", submittedBy: "p1", proposed: getTemple(SLUG)! }), 400, /Nothing changed/);
    expectRefusal(() => proposeRevision({ templeSlug: "no-such-temple", actingRole: "priest", submittedBy: "p1", proposed: getTemple(SLUG)! }), 404, /not found/);
  });
});

describe("revision approval", () => {
  it("leaves the live page untouched until approved, then stamps only the vouched area", () => {
    const originalHours = getTemple(SLUG)!.openingHours[0].verificationStatus;
    const revision = proposeRevision({
      templeSlug: SLUG,
      actingRole: "priest",
      submittedBy: "priest1",
      proposed: edited(SLUG, (t) => {
        t.worshipSop[0].instruction = "Enter by the Ranga Ranga gopuram.";
        t.status = "draft"; // must be ignored
        t.slug = "hijack"; // must be ignored
      }),
    });
    expect(revision.changedAreas).toEqual(["worshipSop"]);
    expect(getTemple(SLUG)!.worshipSop[0].instruction).not.toBe("Enter by the Ranga Ranga gopuram.");

    const done = reviewRevision(revision.id, "approved", "admin");
    expect(done.status).toBe("approved");
    const live = getTemple(SLUG)!;
    expect(live.status).toBe("published");
    expect(live.slug).toBe(SLUG);
    expect(live.worshipSop[0].instruction).toBe("Enter by the Ranga Ranga gopuram.");
    expect(live.worshipSop.every((s) => s.verificationStatus === "authority-verified")).toBe(true);
    expect(live.worshipSop[0].verifiedBy).toEqual({ role: "priest", username: "priest1" });
    expect(live.openingHours[0].verificationStatus).toBe(originalHours);
    expect(readAudit().some((e) => e.action === "revision.approved" && e.target.startsWith(SLUG))).toBe(true);
  });

  it("lets temple management confirm a section as current without changing it", () => {
    const revision = proposeRevision({ templeSlug: OTHER, actingRole: "temple_management", submittedBy: "tm1", proposed: getTemple(OTHER)!, confirmedAreas: ["openingHours"] });
    expect(revision.changedAreas).toEqual([]);
    reviewRevision(revision.id, "approved", "admin");
    expect(getTemple(OTHER)!.openingHours.every((h) => h.verificationStatus === "authority-verified")).toBe(true);
  });

  it("never stamps a contributor's change as authority-verified", () => {
    const before = getTemple(OTHER)!.festivals.map((f) => f.verificationStatus);
    const revision = proposeRevision({
      templeSlug: OTHER,
      actingRole: "contributor",
      submittedBy: "c1",
      proposed: edited(OTHER, (t) => { t.narrative.summaryIntro += " (edited)"; }),
      confirmedAreas: ["festivals"],
    });
    expect(revision.confirmedAreas).toEqual([]);
    reviewRevision(revision.id, "approved", "admin");
    expect(getTemple(OTHER)!.festivals.map((f) => f.verificationStatus)).toEqual(before);
  });

  it("marks a revision as conflict if the temple changed underneath it", () => {
    const revision = proposeRevision({ templeSlug: SLUG, actingRole: "priest", submittedBy: "priest2", proposed: edited(SLUG, (t) => { t.worshipSop[0].instruction = "Stale edit"; }) });
    replacePublishedTemple(edited(SLUG, (t) => { t.narrative.summaryIntro += " (someone else)"; }));
    const done = reviewRevision(revision.id, "approved", "admin");
    expect(done.status).toBe("conflict");
    expect(getTemple(SLUG)!.worshipSop[0].instruction).not.toBe("Stale edit");
  });

  it("requires a reason to reject and allows one open revision per person per temple", () => {
    const first = proposeRevision({ templeSlug: SLUG, actingRole: "priest", submittedBy: "priest3", proposed: edited(SLUG, (t) => { t.worshipSop[0].instruction = "A"; }) });
    expectRefusal(() => proposeRevision({ templeSlug: SLUG, actingRole: "priest", submittedBy: "priest3", proposed: edited(SLUG, (t) => { t.worshipSop[0].instruction = "B"; }) }), 409, /already/);
    expectRefusal(() => reviewRevision(first.id, "rejected", "admin"), 400, /reason/);
    expect(reviewRevision(first.id, "rejected", "admin", "Please cite the temple notice").status).toBe("rejected");
    expectRefusal(() => reviewRevision(first.id, "approved", "admin"), 409, /already/);
  });
});
