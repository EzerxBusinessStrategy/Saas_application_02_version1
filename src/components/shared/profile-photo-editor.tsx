"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  currentUserQueryKey,
  removeCurrentUserAvatar,
  uploadCurrentUserAvatar,
  useCurrentUser,
  type CurrentUserPortal,
} from "@/features/identity/api/current-user-api";
import { cropImageToWebp, blobToBase64, isAllowedAvatarFile } from "@/lib/avatar/crop-image";
import { detectFaces } from "@/lib/avatar/detect-faces";
import { clampCrop, cropForFaces, type CropRect } from "@/lib/avatar/face-crop";

type EditorPhase = "idle" | "preparing" | "cropping" | "uploading";

export function ProfilePhotoEditor({ portal }: { portal: CurrentUserPortal }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profile = useCurrentUser(portal);
  const [phase, setPhase] = useState<EditorPhase>("idle");
  const [source, setSource] = useState<{ image: HTMLImageElement; crop: CropRect } | null>(null);
  const name = profile.data?.user.displayName || "Account";
  const avatarUrl = profile.data?.user.avatarUrl;
  const busy = phase === "preparing" || phase === "uploading";

  const openPicker = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedAvatarFile(file)) {
      toast.error("Choose a JPG, PNG, or WebP image up to 5 MB.");
      return;
    }
    setPhase("preparing");
    try {
      const image = await loadImage(file);
      const faces = await detectFaces(image);
      setSource({
        image,
        crop: cropForFaces(faces, image.naturalWidth, image.naturalHeight),
      });
      setPhase("cropping");
    } catch {
      toast.error("That photo could not be prepared. Try a different image.");
      setPhase("idle");
    }
  };

  const applyCrop = async (crop: CropRect) => {
    if (!source) return;
    setPhase("uploading");
    try {
      const blob = await cropImageToWebp(source.image, crop);
      const data = await blobToBase64(blob);
      const updated = await uploadCurrentUserAvatar(portal, data);
      queryClient.setQueryData(currentUserQueryKey(portal), updated);
      toast.success("Profile photo updated");
      setSource(null);
      setPhase("idle");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The profile photo could not be uploaded.");
      setPhase("cropping");
    }
  };

  const removePhoto = async () => {
    if (busy || !avatarUrl) return;
    setPhase("uploading");
    try {
      const updated = await removeCurrentUserAvatar(portal);
      queryClient.setQueryData(currentUserQueryKey(portal), updated);
      toast.success("Profile photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The profile photo could not be removed.");
    } finally {
      setPhase("idle");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>Used in the header and across every portal for this account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={openPicker}
            disabled={busy}
            aria-label="Change profile photo"
          >
            <UserAvatar name={name} src={avatarUrl} size="xl" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-foreground/70 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <span className="flex flex-col items-center gap-1">
                <Camera className="size-5" aria-hidden="true" />
                Change
              </span>
            </span>
          </button>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">JPG, PNG or WebP · Max 5 MB</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={openPicker}>
                {phase === "preparing" ? "Preparing photo..." : phase === "uploading" ? "Uploading..." : "Change photo"}
              </Button>
              {avatarUrl ? (
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void removePhoto()}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onFile(file);
            }}
          />
        </CardContent>
      </Card>
      <AvatarCropDialog
        open={phase === "cropping" || (phase === "uploading" && Boolean(source))}
        source={source}
        uploading={phase === "uploading"}
        onCancel={() => {
          if (phase === "uploading") return;
          setSource(null);
          setPhase("idle");
        }}
        onConfirm={(crop) => void applyCrop(crop)}
      />
    </>
  );
}

function AvatarCropDialog({
  open,
  source,
  uploading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  source: { image: HTMLImageElement; crop: CropRect } | null;
  uploading: boolean;
  onCancel: () => void;
  onConfirm: (crop: CropRect) => void;
}) {
  const [crop, setCrop] = useState<CropRect | null>(null);
  const activeCrop = crop ?? source?.crop ?? null;
  const image = source?.image;

  useEffect(() => {
    setCrop(null);
  }, [source]);
  const minSize = image ? Math.min(image.naturalWidth, image.naturalHeight) / 3 : 1;
  const maxSize = image ? Math.min(image.naturalWidth, image.naturalHeight) : 1;
  const zoom = activeCrop && maxSize > 0 ? maxSize / activeCrop.size : 1;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent title="Edit profile photo" className="max-w-md">
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Edit profile photo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Drag to reposition. Zoom if the face needs more space.</p>
          </div>
          {image && activeCrop ? (
            <CropViewport
              image={image}
              crop={activeCrop}
              disabled={uploading}
              onChange={(next) => setCrop(clampCrop(next, image.naturalWidth, image.naturalHeight))}
            />
          ) : null}
          <label className="block text-sm font-medium">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              className="mt-2 w-full"
              disabled={!image || uploading}
              value={zoom}
              onChange={(event) => {
                if (!image || !activeCrop) return;
                const nextZoom = Number(event.target.value);
                const size = clampNumber(maxSize / nextZoom, minSize, maxSize);
                const centerX = activeCrop.x + activeCrop.size / 2;
                const centerY = activeCrop.y + activeCrop.size / 2;
                setCrop(clampCrop({
                  x: centerX - size / 2,
                  y: centerY - size / 2,
                  size,
                }, image.naturalWidth, image.naturalHeight));
              }}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={uploading} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" disabled={!activeCrop || uploading} onClick={() => activeCrop && onConfirm(activeCrop)}>
              {uploading ? "Uploading..." : "Use photo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CropViewport({
  image,
  crop,
  disabled,
  onChange,
}: {
  image: HTMLImageElement;
  crop: CropRect;
  disabled: boolean;
  onChange: (crop: CropRect) => void;
}) {
  const viewport = 240;
  const scale = viewport / crop.size;
  const drag = useRef<null | { x: number; y: number; crop: CropRect }>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, crop };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const deltaX = (start.x - event.clientX) / scale;
    const deltaY = (start.y - event.clientY) / scale;
    onChange(clampCrop({
      x: start.crop.x + deltaX,
      y: start.crop.y + deltaY,
      size: start.crop.size,
    }, image.naturalWidth, image.naturalHeight));
  };

  return (
    <div
      className="relative mx-auto size-[240px] cursor-grab overflow-hidden rounded-full bg-muted touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      role="presentation"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img
        src={image.src}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: image.naturalWidth * scale,
          height: image.naturalHeight * scale,
          left: -crop.x * scale,
          top: -crop.y * scale,
        }}
      />
    </div>
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file is not a readable image."));
    };
    image.src = url;
  });
}
