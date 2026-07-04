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
};

export default nextConfig;
