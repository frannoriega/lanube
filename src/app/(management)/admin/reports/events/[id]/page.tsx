import EventReportView from "@/components/templates/admin/report/event-report";
import { getEventReport } from "@/lib/db/eventReports";
import { serializeJson } from "@/lib/json-bigint";
import { notFound } from "next/navigation";

/**
 * Reporte de un evento (milestone 31). El permiso (`reports:view`) lo exige el `layout.tsx` de
 * `/admin/reports`. Se llega tocando un evento en el bloque «Eventos» de los reportes.
 */
export default async function EventReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getEventReport(id);
  if (!report) notFound();
  return <EventReportView data={serializeJson(report)} />;
}
