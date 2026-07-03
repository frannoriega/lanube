import { EventForm } from "@/components/organisms/admin/event-form";
import { Suspense } from "react";

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo evento</h1>
      <Suspense>
        <EventForm mode="create" />
      </Suspense>
    </div>
  );
}
