import "./globals.css";
import type { Metadata } from "next";
import { config } from "@/config/booking.config.ts";

export const metadata: Metadata = { title: `${config.teamName} | 予約`, robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
