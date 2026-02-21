import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "razvan-openclaw.tail7ae51e.ts.net",
    "*.tail7ae51e.ts.net",
  ],
};

export default nextConfig;
