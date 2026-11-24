import "./globals.css";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings.ts";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  return { title: `${s?.teamName ?? "予約"} | 予約`, robots: { index: false } };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
