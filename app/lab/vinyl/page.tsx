'use client';

import dynamic from 'next/dynamic';

// three.js needs the browser, and this keeps the 3D code out of every
// other page's bundle.
const VinylLab = dynamic(() => import('@/components/vinyl/VinylLab'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-84px)] items-center justify-center text-sm text-fg-muted">
      Setting up the turntable…
    </div>
  ),
});

export default function VinylLabPage() {
  return <VinylLab />;
}
