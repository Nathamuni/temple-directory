/**
 * Static-export build flag.
 *
 * The directory normally runs as a Node server: login, /contribute, /status and
 * the admin screens read a session cookie and write JSON files to disk. Neither
 * is possible on a static host, so `npm run build:static` sets STATIC_EXPORT=1,
 * moves those routes out of src/app for the duration of the build, and emits a
 * read-only public site into out/.
 *
 * Components that would otherwise call cookies() — which forces a route to be
 * dynamic and fails `output: "export"` — branch on this instead.
 */
export const IS_STATIC = process.env.STATIC_EXPORT === "1";
