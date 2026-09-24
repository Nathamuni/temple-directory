import { pendingGrantCount } from "./store/accounts";
import { pendingCorrectionCount } from "./store/corrections";
import { pendingRevisionCount } from "./store/revisions";
import { getAllTemples } from "./temples";

/** Everything waiting on an admin decision, by queue. */
export function adminQueues() {
  return {
    applications: pendingGrantCount(),
    submissions: getAllTemples().filter((t) => t.status === "draft" || t.status === "pending").length,
    revisions: pendingRevisionCount(),
    corrections: pendingCorrectionCount(),
  };
}

export function adminQueueCount(): number {
  const q = adminQueues();
  return q.applications + q.submissions + q.revisions + q.corrections;
}
