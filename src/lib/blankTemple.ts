import type { Temple, VisitingInfo } from "./types";

/** An empty, structurally-complete Temple — the starting point for an import or a new draft. */
export function blankVisitingInfo(): VisitingInfo {
  return { sourceIds: [], verificationStatus: "unverified" };
}

export function blankTemple(): Temple {
  return {
    templeId: "",
    slug: "",
    status: "draft",
    identity: {
      nameEn: "",
      alternateNames: [],
      presidingDeity: "",
      tradition: "",
      templeType: "",
      sacredClassifications: [],
      spiritualSignificanceShort: "",
    },
    location: { city: "", district: "", stateProvince: "", country: "India" },
    governance: {},
    narrative: { summaryIntro: "", documentedHistory: "", associatedSaints: [] },
    editorial: { overallVerificationStatus: "unverified" },
    visitingInfo: blankVisitingInfo(),
    openingHours: [],
    worshipSop: [],
    shrines: [],
    poojas: [],
    festivals: [],
    media: [],
    sources: [],
    extensions: {
      otherDeities: [],
      majorFestivalIds: [],
      nearbyTemples: [],
      reviews: [],
      spiritualOutcomes: [],
      facilities: [],
    },
  };
}
