import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "신영라파마 시약 재고 관리",
  description: "신영라파마 사내 시약 재고, 주문, 출고 관리 시스템"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
