import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="aimasho home">
      <span className="brand-mark">a</span>
      {!compact && <span>aimasho</span>}
    </Link>
  );
}
