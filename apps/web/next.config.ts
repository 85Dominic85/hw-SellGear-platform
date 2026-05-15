import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indica a Next.js que el output es standalone para Vercel y Docker
  output: "standalone",

  // Variables de entorno que deben estar presentes en build time
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Bloqueo de indexacion a nivel de header HTTP (cubre assets, JSON,
  // PDFs y rutas que el <meta> no toca). Approach recomendado por
  // Vercel para herramientas internas.
  //
  // NOTA: si en el futuro se monta dominio propio (p.ej. hw.qamarero.com),
  // verificar en Vercel que este header sigue activo. Por defecto Vercel
  // solo lo aplica automaticamente en *.vercel.app — en custom domains
  // tiene que estar configurado aqui (lo esta) y respetarse.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
