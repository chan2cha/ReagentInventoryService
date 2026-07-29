import type { Metadata } from "next";
import "./globals.css";
import { ConfirmationDialogProvider } from "./confirmation-dialog";

export const metadata: Metadata = {
  title: "신영로파마 시약 재고 관리",
  description: "신영로파마 사내 시약 재고, 주문, 출고 관리 시스템"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body><ConfirmationDialogProvider>{children}</ConfirmationDialogProvider></body>
    </html>
  );
}
