import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "dev.example.com",
    "*.example.com",
  ],
};

export default nextConfig;
