/**
 * Moves legacy contributor-requests.json rows (plaintext passwords) into the
 * hashed account store. The app also does this automatically on first use;
 * this script is for running it deliberately against a deployed DATA_DIR.
 *
 *   DATA_DIR=/var/data npm run migrate:accounts
 */
import { migrateLegacyRequests } from "../src/lib/store/accounts";

const moved = migrateLegacyRequests();
console.log(moved ? `Migrated ${moved} request(s); no plaintext passwords remain.` : "Nothing to migrate.");
