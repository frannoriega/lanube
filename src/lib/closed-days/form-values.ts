import type { ClosedDayInput } from "@/lib/schemas/closed-days";

/**
 * Valores iniciales del formulario de alta de un día cerrado: hoy, día completo. Vive fuera
 * del componente porque la página (Server Component) lo llama, y una función exportada desde
 * un módulo `"use client"` no se puede invocar desde el servidor.
 */
export function emptyClosedDay(today: string): ClosedDayInput {
  return {
    title: "",
    startDate: today,
    endDate: today,
    startTime: null,
    endTime: null,
    source: "MANUAL_OTHER",
  };
}
