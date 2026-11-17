import { ActivityCalendar } from "@/components/organisms/activity-calendar/ActivityCalendar";

/**
 * Calendario de actividades de un usuario (milestone 32): sus reservas, los eventos
 * publicados (con el botón para inscribirse), los días cerrados y lo que reservaron otros como
 * «Ocupado». Solo lectura: se reserva desde el calendario de cada espacio. La sesión y el gate
 * de políticas los resuelve el layout de `/user`.
 */
export default function UserCalendarPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-muted-foreground">
          Tus reservas, los eventos y los días en que La Nube está cerrada. Para
          reservar, entrá al espacio que quieras.
        </p>
      </div>
      <ActivityCalendar scope="user" />
    </div>
  );
}
