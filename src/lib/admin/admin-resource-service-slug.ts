export const ADMIN_RESOURCE_SERVICE_SLUGS = [
  "coworking",
  "lab",
  "auditorium",
  "meeting",
] as const;

export type AdminResourceServiceSlug =
  (typeof ADMIN_RESOURCE_SERVICE_SLUGS)[number];

export const ADMIN_RESOURCE_SERVICE_OPTIONS: {
  slug: AdminResourceServiceSlug;
  label: string;
}[] = [
  { slug: "coworking", label: "Coworking" },
  { slug: "lab", label: "Laboratorio" },
  { slug: "auditorium", label: "Auditorio" },
  { slug: "meeting", label: "Salas de reunión" },
];

export function isAdminResourceServiceSlug(
  s: string,
): s is AdminResourceServiceSlug {
  return (ADMIN_RESOURCE_SERVICE_SLUGS as readonly string[]).includes(s);
}

export function defaultAdminResourceServiceSlug(): AdminResourceServiceSlug {
  return "coworking";
}
