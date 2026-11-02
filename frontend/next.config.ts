import type { NextConfig } from "next";
import { BACKEND_ORIGIN } from "./src/lib/backendOrigin";

const nextConfig: NextConfig = {
  // Bundles the server and only the dependencies it actually imports, so
  // the container image carries no node_modules tree. Harmless outside
  // Docker: it writes .next/standalone alongside the usual output.
  output: "standalone",
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
