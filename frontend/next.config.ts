import type { NextConfig } from "next";
import { BACKEND_ORIGIN } from "./src/lib/backendOrigin";

// Set when this app is served behind hiday.io's marketing site (Next.js
// multi-zones): the site proxies every path it doesn't own to this app, and a
// distinct prefix keeps this app's /_next/static files from colliding with the
// site's own. Leave unset when the app is served on its own domain, e.g. when
// self-hosting.
const ASSET_PREFIX = process.env.ASSET_PREFIX || undefined;

const nextConfig: NextConfig = {
  assetPrefix: ASSET_PREFIX,
  devIndicators: {
    position: "bottom-right",
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
