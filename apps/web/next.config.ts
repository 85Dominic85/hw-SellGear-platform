import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indica a Next.js que el output es standalone para Vercel y Docker
  output: "standalone",

  // Variables de entorno que deben estar presentes en build time
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
};

export default nextConfig;
