import type { NextConfig } from "next";

// Static export: requerido para Cloudflare Pages (sin server), igual que la flota.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
