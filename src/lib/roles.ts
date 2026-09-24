/**
 * Role vocabulary, shared by server and client (no fs imports here).
 *
 * One person has one account. `devotee` is what every active account is;
 * the other roles are granted on application and admin approval, and all but
 * `contributor` are tied to one temple — a priest at one temple has no say
 * over another.
 */

export type GrantRole = "contributor" | "temple_management" | "priest" | "seva_coordinator";
export type Role = "devotee" | GrantRole | "admin";

export const GRANT_ROLES: GrantRole[] = ["contributor", "temple_management", "priest", "seva_coordinator"];

export const TEMPLE_SCOPED: GrantRole[] = ["temple_management", "priest", "seva_coordinator"];

export function isTempleScoped(role: GrantRole): boolean {
  return TEMPLE_SCOPED.includes(role);
}

export function isGrantRole(value: string): value is GrantRole {
  return (GRANT_ROLES as string[]).includes(value);
}

export const ROLE_LABEL: Record<Role, string> = {
  devotee: "Devotee",
  contributor: "Contributor",
  temple_management: "Temple Management",
  priest: "Priest / Religious Authority",
  seva_coordinator: "Seva Coordinator",
  admin: "Platform Admin",
};

export const ROLE_PURPOSE: Record<GrantRole, string> = {
  contributor: "Research and submit temple information with sources.",
  temple_management: "Maintain your temple's official operational information — hours, entry rules, poojas, festivals.",
  priest: "Verify worship, ritual, SOP and sacred-route information for your temple.",
  seva_coordinator: "Manage volunteer requirements and assignments for your temple.",
};

export interface ApplicationField {
  name: string;
  label: string;
  required: boolean;
  long?: boolean;
  hint?: string;
}

/**
 * What each application asks. Deliberately no identity-document uploads:
 * affiliation is checked against public references (official email, the
 * temple's website, a letter reference) and the admin records the outcome.
 */
export const APPLICATION_FIELDS: Record<GrantRole, ApplicationField[]> = {
  contributor: [
    { name: "location", label: "Where are you based?", required: true },
    { name: "motivation", label: "Why do you want to contribute?", required: true, long: true },
    { name: "familiarWith", label: "Temples or regions you know well", required: true, long: true },
    { name: "experience", label: "Relevant experience", required: false, long: true },
    { name: "referenceLink", label: "Reference or link (optional)", required: false, hint: "Blog, publication, profile…" },
  ],
  temple_management: [
    { name: "position", label: "Your position at the temple", required: true, hint: "Executive officer, trustee, office staff…" },
    { name: "officialEmail", label: "Official email", required: true, hint: "An address on the temple's own domain is quickest to verify." },
    { name: "officialPhone", label: "Official phone", required: true },
    { name: "affiliationProof", label: "How can we confirm your affiliation?", required: true, long: true, hint: "A page on the official website listing you, a letter reference number, or who at the temple can confirm. Please do not upload ID documents." },
    { name: "notes", label: "Anything else", required: false, long: true },
  ],
  priest: [
    { name: "designation", label: "Role / designation", required: true, hint: "Archaka, bhattar, pujari…" },
    { name: "managementReference", label: "Temple-management contact who can confirm you", required: true, long: true },
    { name: "notes", label: "Anything else", required: false, long: true },
  ],
  seva_coordinator: [
    { name: "managementReference", label: "Temple-management contact who can confirm you", required: true, long: true },
    { name: "experience", label: "Volunteer coordination experience", required: false, long: true },
  ],
};
