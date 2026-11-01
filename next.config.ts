import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: (process.env.CLAWDIFY_ALLOWED_DEV_ORIGINS || "")
    .split(",").map((origin) => origin.trim()).filter(Boolean),
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
