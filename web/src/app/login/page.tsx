import { AppHeader } from "@/components/language-provider";
import { LoginCard } from "@/components/login-card";

function safeNextPath(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <><AppHeader title="login" /><LoginCard nextPath={safeNextPath(next)} /></>;
}
