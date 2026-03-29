import type { NextConfig } from "next";

const API_ORIGIN = "https://signsafe-api.dsmhs.kr";

// Content-Security-Policy directives.
// - script-src 'unsafe-inline': Next.js requires inline scripts for hydration.
// - style-src 'unsafe-inline': Tailwind CSS v4 inlines critical styles.
// - worker-src blob:: PDF.js spawns a Web Worker from a blob URL.
// - img-src blob: data:: PDF page renders output blob images; data: for base64 avatars.
// - connect-src: API calls go to signsafe-api; blob: for XHR on local blob objects.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${API_ORIGIN} blob:`,
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join("; ")
  .trim();

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
