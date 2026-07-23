import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["exceljs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    }
  },
  async redirects() {
    return [
      {
        source: "/orders/templates",
        destination: "/orders/new",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
