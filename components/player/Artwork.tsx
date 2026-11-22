'use client';

import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { artworkUrl, loadArtworkDirectory } from '@/lib/tauri/assets';

let cachedDirectory: string | null = null;

/** The artwork folder, resolved once and shared by every cover. */
function useArtworkDirectory(): string | null {
  const [directory, setDirectory] = useState(cachedDirectory);

  useEffect(() => {
    if (directory) return;
    loadArtworkDirectory()
      .then((resolved) => {
        cachedDirectory = resolved;
        setDirectory(resolved);
      })
      .catch(() => {});
  }, [directory]);

  return directory;
}

interface ArtworkProps {
  hash: string | null;
  size?: 'thumb' | 'full';
  className?: string;
  alt?: string;
}

/** A cached cover, or a quiet placeholder when there is none. */
export function Artwork({ hash, size = 'thumb', className, alt = '' }: ArtworkProps) {
  const directory = useArtworkDirectory();
  const [failedHash, setFailedHash] = useState<string | null>(null);

  if (!hash || !directory || failedHash === hash) {
    return (
      <div
        className={cn('flex items-center justify-center bg-surface-3 text-fg-subtle', className)}
        aria-hidden={alt ? undefined : true}
      >
        <Music2 className="size-[40%] max-h-6 max-w-6" />
      </div>
    );
  }

  return (
    // Local asset-protocol file; next/image cannot optimize it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artworkUrl(directory, hash, size)}
      alt={alt}
      draggable={false}
      onError={() => setFailedHash(hash)}
      className={cn('object-cover', className)}
    />
  );
}
