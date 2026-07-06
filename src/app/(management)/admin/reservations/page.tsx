import { ReservationsPageContent } from "./_reservations-page-content";
import { getPublicSpaces } from "@/lib/db/spaces";
import type { SpaceOption } from "@/components/molecules/admin-resource-type-combobox";
import { Suspense } from "react";

export default async function AdminReservationsPage() {
  const spaces = await getPublicSpaces();
  const spaceOptions: SpaceOption[] = spaces
    .filter((s) => s.isReservable)
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-la-nube-primary border-b-transparent" />
        </div>
      }
    >
      <ReservationsPageContent spaceOptions={spaceOptions} />
    </Suspense>
  );
}
