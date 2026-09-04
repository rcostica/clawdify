import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "dev.example.com",
    "*.example.com",
  ],
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
