import type { NextConfig } from "next";
import { BACKEND_ORIGIN } from "./src/lib/backendOrigin";

const nextConfig: NextConfig = {
  // Only for the container image, which needs a self-contained server with
  // no node_modules tree. Vercel does not support this option — it manages
  // its own output — so it must stay off everywhere except the Dockerfile,
  // which sets DOCKER_BUILD.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
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
