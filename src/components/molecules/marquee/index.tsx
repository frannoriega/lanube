"use client";

import { Children, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MarqueeDirection = "left" | "right";

export type MarqueeProps = {
  children: React.ReactNode;
  /** Width of the gradient mask at each edge (px or CSS value). Content fades to 100% transparent at edges. */
  gradientWidth?: number | string;
  /** Speed in pixels per second */
  speed?: number;
  /** Scroll direction: "left" = right-to-left (default), "right" = left-to-right */
  direction?: MarqueeDirection;
  /** Pause the marquee when hovered */
  pauseOnHover?: boolean;
  /** Additional class name for the container */
  className?: string;
  /** Additional class name for each child wrapper */
  childClassName?: string;
};

export function Marquee({
  children,
  gradientWidth = 80,
  speed = 50,
  direction = "left",
  pauseOnHover = false,
  className,
  childClassName,
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [multiplier, setMultiplier] = useState(2);
  const [contentWidth, setContentWidth] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const calculateLayout = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return;

    const containerW = containerRef.current.getBoundingClientRect().width;
    const contentW = contentRef.current.getBoundingClientRect().width;

    if (contentW <= 0) return;

    setContentWidth(contentW);
    // Clone children until we fill the container width; minimum 2 for seamless infinite loop
    const fillMultiplier = Math.ceil(containerW / contentW);
    setMultiplier(Math.max(2, fillMultiplier));
  }, []);

  useEffect(() => {
    calculateLayout();

    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const resizeObserver = new ResizeObserver(calculateLayout);
    resizeObserver.observe(container);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [calculateLayout, children]);

  const gradientWidthValue =
    typeof gradientWidth === "number" ? `${gradientWidth}px` : gradientWidth;

  const maskStyle = useMemo(
    () =>
      ({
        "--marquee-gradient-width": gradientWidthValue,
        maskImage: `linear-gradient(to right, transparent 0, black var(--marquee-gradient-width), black calc(100% - var(--marquee-gradient-width)), transparent 100%)`,
        WebkitMaskImage: `linear-gradient(to right, transparent 0, black var(--marquee-gradient-width), black calc(100% - var(--marquee-gradient-width)), transparent 100%)`,
      }) as React.CSSProperties,
    [gradientWidthValue]
  );

  const duration = contentWidth > 0 ? contentWidth / speed : 20;

  const childArray = useMemo(() => Children.toArray(children), [children]);

  const renderContentUnit = (keyPrefix: string) => (
    <div key={keyPrefix} className="flex shrink-0 items-center">
      {childArray.map((child, i) => (
        <div key={`${keyPrefix}-${i}`} className={cn("shrink-0", childClassName)}>
          {child}
        </div>
      ))}
    </div>
  );

  const isAnimationPaused = pauseOnHover && isPaused;
  const isReversed = direction === "right";

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={maskStyle}
      onMouseEnter={pauseOnHover ? () => setIsPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setIsPaused(false) : undefined}
    >
      <div
        className="flex animate-marquee"
        style={
          {
            "--marquee-duration": `${duration}s`,
            "--marquee-translate": `${-contentWidth}px`,
            animationPlayState: isAnimationPaused ? "paused" : "running",
            animationDirection: isReversed ? "reverse" : "normal",
          } as React.CSSProperties
        }
      >
        <div ref={contentRef} className="flex shrink-0 items-center">
          {childArray.map((child, i) => (
            <div key={`initial-${i}`} className={cn("shrink-0", childClassName)}>
              {child}
            </div>
          ))}
        </div>
        {Array.from({ length: multiplier - 1 }, (_, i) =>
          renderContentUnit(`clone-${i}`)
        )}
      </div>
    </div>
  );
}
