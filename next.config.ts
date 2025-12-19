import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

// next.config.js
module.exports = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};


export default nextConfig;
