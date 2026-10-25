import type { NextConfig } from "next";

const noStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Vercel-CDN-Cache-Control", value: "no-store" },
];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://s3.us-east-005.backblazeb2.com",
      "frame-src 'self' https://s3.us-east-005.backblazeb2.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_BUILD_ID ||
      "dev",
  },
  cacheComponents: true,
  async redirects() {
    return [
      {
        source: "/downloads/etucenter-:version.apk",
        destination: "/downloads/etudnet-:version.apk",
        permanent: true,
      },
      {
        source: "/downloads/etudna-:version.apk",
        destination: "/downloads/etudnet-:version.apk",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Les pages et API authentifiées ne doivent jamais être servies depuis
      // le cache navigateur/CDN : sinon une ancienne version de l'interface
      // (ou des données financières) peut réapparaître après un déploiement.
      { source: "/api/:path*", headers: noStoreHeaders },
      { source: "/admin", headers: noStoreHeaders },
      { source: "/admin/:path*", headers: noStoreHeaders },
      { source: "/prof", headers: noStoreHeaders },
      { source: "/prof/:path*", headers: noStoreHeaders },
      { source: "/eleve", headers: noStoreHeaders },
      { source: "/eleve/:path*", headers: noStoreHeaders },
      { source: "/super-admin", headers: noStoreHeaders },
      { source: "/super-admin/:path*", headers: noStoreHeaders },
      { source: "/profil", headers: noStoreHeaders },
      { source: "/profil/:path*", headers: noStoreHeaders },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
