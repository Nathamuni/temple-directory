import type { NextConfig } from "next";

// Static export and the login/contribute routes (cookies, dynamic API routes)
// are mutually exclusive under Next.js. `npm run build:static` sets this flag
// and moves those routes aside for the duration of the build, producing the
// read-only public site in out/. A normal `npm run build` is unaffected.
const isStatic = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isStatic
    ? {
        output: "export" as const,
        // No image optimizer on a static host.
        images: { unoptimized: true },
        // Emit out/temple/<slug>/index.html rather than out/temple/<slug>.html,
        // which every static host resolves without per-host redirect rules.
        trailingSlash: true,
      }
    : {}),

  // The contribute/status/account routes write JSON files under data/
  // (temples, accounts, revisions) at request time;
  // without this, the dev server's own watcher treats that write as a
  // source change and recompiles mid-request.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/data/**",
      ],
    };
    return config;
  },
};

export default nextConfig;
