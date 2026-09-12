import { FriendPageClient } from "@/components/friend-page-client";

export default async function FriendPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return <FriendPageClient otherUid={uid} />;
}
