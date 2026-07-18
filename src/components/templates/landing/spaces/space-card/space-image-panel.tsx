"use client";

import Image from "next/image";
import { useState } from "react";
import { Star, type LucideIcon } from "lucide-react";

interface SpaceImagePanelProps {
  imageUrl: string | null;
  name: string;
  Icon: LucideIcon | null;
  isFeatured: boolean;
}

export function SpaceImagePanel({
  imageUrl,
  name,
  Icon,
  isFeatured,
}: SpaceImagePanelProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!imageUrl && !imgError;

  return (
    <>
      {showImage ? (
        <Image
          src={imageUrl!}
          alt={name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 192px"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary">
          {Icon && (
            <Icon className="h-14 w-14 text-white/90" strokeWidth={1.5} />
          )}
        </div>
      )}

      {isFeatured && (
        <span className="absolute left-3 top-3 rounded-full bg-black/55 p-1.5 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur-sm">
          <Star className="size-4 fill-yellow-400 stroke-yellow-400" />
        </span>
      )}
    </>
  );
}
