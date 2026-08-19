"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 96,
} as const;

const textSizes = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-2xl",
} as const;

export type UserAvatarSize = keyof typeof sizes;

export function UserAvatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: UserAvatarSize;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const pixels = sizes[size];
  const showPhoto = Boolean(src) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground",
        textSizes[size],
        className,
      )}
      style={{ width: pixels, height: pixels }}
      aria-hidden="true"
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs are not Next image hosts.
        <img
          src={src ?? ""}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsFor(name)
      )}
    </span>
  );
}

export function initialsFor(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
