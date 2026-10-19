import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase auth reads cookies on almost every route, so this app uses the
  // classic dynamic rendering model instead of Cache Components.
  cacheComponents: false,
  transpilePackages: ["@platelink/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
