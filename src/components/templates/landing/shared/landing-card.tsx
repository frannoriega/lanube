import { cn } from "@/lib/utils";
import Link from "next/link";

export interface LandingCardData {
  href: string;
  label: string;
}

/**
 * Boarding-pass-style tile for an upcoming event: a cover (image or branded gradient with
 * the event type), a mono date chip, weekday badges, and a single registration CTA.
 */
export function LandingCard({
  data,
  children,
  className,
}: {
  data?: LandingCardData;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 focus-within:ring-2 focus-within:ring-brand-primary hover:-translate-y-1 hover:border-brand-primary hover:shadow-md",
        className,
      )}
    >
      {children}
      {/* Full-card link — last in DOM so it stacks above the cover, captured by z-[2] CTA above */}
      {data && (
        <Link
          href={data.href}
          className="absolute inset-0 z-1"
          aria-label={data.label}
          tabIndex={-1}
        />
      )}
    </article>
  );
}
