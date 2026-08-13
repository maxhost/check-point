import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright usa 127.0.0.1; la IP LAN permite QA manual desde el teléfono.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.100.7"],
};

export default nextConfig;
