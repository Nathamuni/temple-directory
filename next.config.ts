import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export is off while login/contribute (cookies, dynamic API routes)
  // are active — the two are mutually exclusive under Next.js static export.
  // Re-enable `output: "export"` only for a build that excludes those routes.

  // The contribute/status/contributor-request routes write JSON files into
  // data/temples/ and data/contributor-requests.json at request time;
  // without this, the dev server's own watcher treats that write as a
  // source change and recompiles mid-request.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/data/temples/**",
        "**/data/contributor-requests.json",
      ],
    };
    return config;
  },
};

export default nextConfig;
