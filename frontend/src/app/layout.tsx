import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CST CRM",
  description: "Customer success operations and revenue intelligence",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
