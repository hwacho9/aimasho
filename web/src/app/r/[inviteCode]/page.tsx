import { AppHeader } from "@/components/language-provider";
import { JoinRoomCard } from "@/components/join-room-card";

export default async function RoomInvitePage({ params }: { params: Promise<{ inviteCode: string }> }) { const { inviteCode } = await params; return <><AppHeader title="roomInvite" /><JoinRoomCard inviteCode={inviteCode} /></>; }
