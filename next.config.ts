import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "dev.example.com",
    "*.example.com",
  ],
};

export default nextConfig;
