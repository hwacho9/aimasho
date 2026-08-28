import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="aimasho home">
      <BrandMark />
      {!compact && <span>aimasho</span>}
    </Link>
  );
}

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">a</span>;
}
