import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConfirmationDialogProvider } from "./confirmation-dialog";
import { PwaRegistration } from "./pwa-registration";

export const metadata: Metadata = {
  title: "신영로파마 시약 재고 관리",
  description: "신영로파마 사내 시약 재고, 주문, 출고 관리 시스템",
  applicationName: "신영로파마 시약 재고 관리",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "시약 재고 관리"
  },
  icons: {
    icon: [
      { url: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#006bb6",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <ConfirmationDialogProvider>{children}</ConfirmationDialogProvider>
        <PwaRegistration />
      </body>
    </html>
  );
}
