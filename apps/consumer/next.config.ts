import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // IP LAN de la sesión de QA. Actualizarla si cambia la red Wi-Fi.
  allowedDevOrigins: ["192.168.100.7"],
};

export default nextConfig;
