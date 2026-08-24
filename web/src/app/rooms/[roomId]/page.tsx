import { AppHeader } from "@/components/language-provider";
import { RoomDetail } from "@/components/room-detail";

export const revalidate = 60;
export function generateStaticParams() { return []; }

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) { const { roomId } = await params; return <><AppHeader title="room" /><RoomDetail roomId={roomId} /></>; }
