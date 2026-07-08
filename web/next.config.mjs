/** @type {import('next').NextConfig} */

// When building for GitHub Pages we produce a fully static export served from a
// project subpath (e.g. /zkburn-decentralized). Both are driven by env so that
// local `pnpm dev` / `pnpm start` keep working with no basePath.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isStaticExport = process.env.STATIC_EXPORT === "true";

const nextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  webpack: (config) => {
    // We use @breadcoop/ui only for presentational components, but its barrel
    // pulls in the Navbar → Privy account widget, which references optional
    // native/onramp deps we never render. Stub them so the static build resolves.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@stripe/crypto": false,
      "@stripe/terminal-js": false,
      "@farcaster/mini-app-solana": false,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
