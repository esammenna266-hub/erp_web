import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ERP System | Dashboard",
  description: "نظام إدارة موارد المؤسسة - لوحة تحكم شاملة للموظفين والفروع والمبيعات",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="ltr" className={inter.variable}>
      <body className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {children}
      </body>
    </html>
  );
}
