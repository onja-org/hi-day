"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react";
import { Modal } from "./Modal";

type ScreenshotZoomProps = {
  url: string;
  alt: string;
  /** Names the image in the dialog title, e.g. "09:40". */
  label: string;
  /** The container's own classes — each surface sizes its tiles its own way. */
  className: string;
  /** The tile's `Image`, kept at the call site so it keeps its own
   * `sizes`/`priority` tuning. */
  image: ReactNode;
  /** Anything drawn over the tile: the tick box, the delete button. */
  children?: ReactNode;
};

/**
 * Opens one screenshot full size: double-click the tile, or press the
 * expand button. The button is the control — keyboard and touch have no
 * double-click; dismissal all comes from `Modal`.
 */
export function ScreenshotZoom({
  url,
  alt,
  label,
  className,
  image,
  children,
}: ScreenshotZoomProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={className}
      onDoubleClick={(event) => {
        // Aimed at that control, not the image underneath it.
        if ((event.target as HTMLElement).closest("button, label")) return;
        setIsOpen(true);
      }}
    >
      {image}
      {children}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Open the screenshot from ${label} full size`}
        title="Open full size"
        className="absolute right-2 bottom-2 flex size-8 cursor-pointer items-center justify-center rounded-brand-sm border-2 border-ink bg-white/90 text-primary-dark transition-colors duration-150 hover:bg-cream focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ArrowsOutSimpleIcon size={16} aria-hidden="true" />
      </button>

      {isOpen && (
        <Modal
          title={`Screenshot · ${label}`}
          size="full"
          onClose={() => setIsOpen(false)}
        >
          {/* contain, not cover: a capture that isn't 16:9 is letterboxed
              rather than cropped — the point is to see all of it. */}
          <div className="relative aspect-video w-full overflow-hidden rounded-brand-sm bg-cream">
            <Image
              src={url}
              alt={alt}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-contain"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
