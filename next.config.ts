import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["exceljs"],
  // NAS, VPS, Windows 서버에서 동일한 Docker 이미지로 실행하기 위한 설정
  output: "standalone",
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
