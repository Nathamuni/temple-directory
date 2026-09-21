import fs from "fs";
import path from "path";

/**
 * Where the directory's mutable data actually lives at runtime.
 *
 * In development this is <repo>/data, tracked in git. On a hosted deploy the
 * application directory is replaced wholesale on every release, so anything a
 * contributor or admin wrote there would silently disappear at the next push.
 * Setting DATA_DIR to a mounted persistent disk (Render: /var/data) keeps the
 * writes outside the deployed code.
 *
 * On first boot that disk is empty, so the repo's committed data is copied in
 * once as a seed. Seeding never overwrites: if the target already holds
 * temples, it is the live copy and the bundled one is ignored.
 */

/** The committed data shipped with the code — seed source, never written to in production. */
const SEED_DIR = path.join(process.cwd(), "data");

/** The live data directory. */
export const DATA_ROOT = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : SEED_DIR;

export const TEMPLES_DIR = path.join(DATA_ROOT, "temples");
export const REQUESTS_FILE = path.join(DATA_ROOT, "contributor-requests.json");

let seeded = false;

/**
 * Copies the bundled data into DATA_ROOT the first time it is used, if and
 * only if DATA_ROOT has no temples yet. Idempotent and safe to call on every
 * read; the guard makes it a no-op after the first call in a process.
 */
export function ensureDataDir(): void {
  if (seeded) return;
  seeded = true;

  // Nothing to relocate when running straight out of the repo.
  if (DATA_ROOT === SEED_DIR) return;

  fs.mkdirSync(DATA_ROOT, { recursive: true });

  const alreadyPopulated =
    fs.existsSync(TEMPLES_DIR) &&
    fs.readdirSync(TEMPLES_DIR).some((f) => f.endsWith(".json"));

  if (alreadyPopulated) return;

  const seedTemples = path.join(SEED_DIR, "temples");
  if (fs.existsSync(seedTemples)) {
    fs.cpSync(seedTemples, TEMPLES_DIR, { recursive: true });
    console.log(`[data] seeded ${TEMPLES_DIR} from bundled data`);
  } else {
    fs.mkdirSync(TEMPLES_DIR, { recursive: true });
  }

  const seedRequests = path.join(SEED_DIR, "contributor-requests.json");
  if (!fs.existsSync(REQUESTS_FILE)) {
    if (fs.existsSync(seedRequests)) {
      fs.copyFileSync(seedRequests, REQUESTS_FILE);
    } else {
      fs.writeFileSync(REQUESTS_FILE, "[]\n", "utf8");
    }
  }
}
