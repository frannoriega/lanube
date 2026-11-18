import {
  AvailableEventsSection,
  MyEventsSection,
  PastEventsSection,
} from "@/components/organisms/dashboard/user-events-sections";

/**
 * «Mis eventos» en tres secciones (milestone 35): los míos (con su próxima sesión), los
 * disponibles para inscribirse y el historial. Los datos los pide cada sección a su endpoint.
 */
export default function UserEventsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Eventos</h1>
        <p className="text-muted-foreground">
          Tus inscripciones, lo que podés sumar y lo que ya pasó.
        </p>
      </div>
      <MyEventsSection />
      <AvailableEventsSection />
      <PastEventsSection />
    </div>
  );
}
