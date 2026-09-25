"use client";

import type { SpaceNavItem } from "@/components/templates/management";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { managementCrumbs } from "@/lib/constants/management-crumbs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

/**
 * Breadcrumbs for every page in the management shells, derived from the pathname by
 * `managementCrumbs` so a new page gets navigation without opting in.
 *
 * Breadcrumbs rather than a bare back button: the section is up to four levels deep
 * (`/admin/events/[id]/participants`), where "back" is ambiguous — from Participantes you
 * may want the event *or* the events list — and a trail also answers "where am I", which
 * the sidebar alone doesn't once you're on a detail page (no sidebar item is highlighted).
 * The parent crumb is additionally mirrored as an explicit "back" arrow on small screens,
 * where the trail is easy to miss.
 */
export function ManagementBreadcrumbs({
  userType,
  spaceNav = [],
}: {
  userType: "user" | "admin";
  spaceNav?: SpaceNavItem[];
}) {
  const pathname = usePathname();
  const crumbs = managementCrumbs(pathname, userType, spaceNav);

  if (crumbs.length === 0) return null;

  // The nearest linked ancestor — what "back" means here.
  const parent = [...crumbs].reverse().find((c) => c.href);

  return (
    <div className="flex items-center gap-3 print:hidden">
      {parent?.href && (
        <Link
          href={parent.href}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          {parent.name}
        </Link>
      )}

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <Fragment key={`${crumb.name}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.name}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
