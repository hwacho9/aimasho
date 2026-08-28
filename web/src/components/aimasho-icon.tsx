type AimashoIconName = "calendar" | "history" | "friend" | "group" | "user" | "sun";

export function AimashoIcon({ name, className = "" }: { name: AimashoIconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className={`aimasho-icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {name === "calendar" ? <g {...common}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" /><path d="m9.2 15 1.8 1.8 4-4.2" /></g> : null}
    {name === "history" ? <g {...common}><path d="M4.2 8.2V4.8h3.4" /><path d="M5 6.3a8.3 8.3 0 1 1-1.1 7.9" /><path d="M12 7.5v5l3.2 1.8" /></g> : null}
    {name === "friend" ? <g {...common}><circle cx="12" cy="8" r="3.3" /><path d="M5.8 20c.5-4 2.5-6 6.2-6s5.7 2 6.2 6" /><path d="M18.5 7.5c1.5.2 2.5 1.3 2.5 2.7 0 1.5-1 2.5-2.5 2.8M19 15.5c1.8.8 2.7 2.2 2.8 4.5" /></g> : null}
    {name === "group" ? <g {...common}><circle cx="9" cy="8.5" r="3" /><circle cx="17" cy="9.5" r="2.3" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M15 15c3.2-.4 5.1 1.3 5.5 4.4" /></g> : null}
    {name === "user" ? <g {...common}><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20c.5-4.3 2.7-6.4 6.5-6.4s6 2.1 6.5 6.4" /></g> : null}
    {name === "sun" ? <g {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></g> : null}
  </svg>;
}
