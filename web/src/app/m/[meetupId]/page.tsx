import type { Metadata } from "next";
import { MeetupPageClient } from "@/components/meetup-page-client";

type PageProps = { params: Promise<{ meetupId: string }> };

const defaultDescription = "予定を合わせて、場所を合わせて、会いましょう。";

async function inviteMetadata(meetupId: string): Promise<{ title: string; description: string } | undefined> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "aimasho";
  const endpoint = `https://asia-northeast1-${projectId}.cloudfunctions.net/getPublicMeetupMetadata?meetupId=${encodeURIComponent(meetupId)}`;
  try {
    const response = await fetch(endpoint, { next: { revalidate: 300 } });
    if (!response.ok) return undefined;
    const value = await response.json() as { title?: unknown; description?: unknown };
    if (typeof value.title !== "string" || !value.title.trim()) return undefined;
    return {
      title: value.title.trim(),
      description: typeof value.description === "string" && value.description.trim() ? value.description.trim() : defaultDescription,
    };
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { meetupId } = await params;
  const preview = await inviteMetadata(meetupId);
  if (!preview) return { title: "aimasho", description: defaultDescription };
  const title = `${preview.title} | aimasho`;
  return {
    title,
    description: preview.description,
    alternates: { canonical: `/m/${meetupId}` },
    openGraph: { type: "website", siteName: "aimasho", title, description: preview.description, url: `/m/${meetupId}` },
    twitter: { card: "summary", title, description: preview.description },
  };
}

export default async function MeetupPage({ params }: PageProps) {
  const { meetupId } = await params;
  return <MeetupPageClient meetupId={meetupId} />;
}
