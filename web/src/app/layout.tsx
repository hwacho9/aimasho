import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { AuthProvider } from "@/components/auth-provider";
import { LanguageProvider } from "@/components/language-provider";

// The shell contains no private server data. A short revalidation window lets
// the CDN serve it instantly without bringing back the old year-long cache.
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aimasho.web.app"),
  title: "aimasho — みんなの「いつ・どこで会う？」を、ひとつに。",
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
      <body className="min-h-full flex flex-col"><AnalyticsProvider><LanguageProvider><AuthProvider>{children}</AuthProvider></LanguageProvider></AnalyticsProvider></body>
    </html>
  );
}
