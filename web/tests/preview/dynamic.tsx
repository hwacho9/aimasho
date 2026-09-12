import { lazy, Suspense, type ComponentType } from "react";
export default function dynamic(loader: () => Promise<ComponentType>) {
  const Component = lazy(async () => ({ default: await loader() }));
  return function PreviewLazy() { return <Suspense fallback={<p>Loading preview…</p>}><Component /></Suspense>; };
}
