import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "aimasho — みんなの「いつ・どこ・何時に出る？」を、ひとつに。",
  description: "予定を合わせて、場所を合わせて、会いましょう。",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><AnalyticsProvider><LanguageProvider>{children}</LanguageProvider></AnalyticsProvider></body>
    </html>
  );
}
