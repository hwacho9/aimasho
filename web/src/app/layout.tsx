import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { AuthProvider } from "@/components/auth-provider";
import { LanguageProvider } from "@/components/language-provider";

// Authentication is restored in the browser. Serving a year-long cached
// static shell can keep an old Firebase Auth bundle alive even after a new
// rollout, so always return the shell from the current deployment.
export const dynamic = "force-dynamic";

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
