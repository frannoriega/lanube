"use client";

import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { formatDateKey } from "@/lib/constants/closed-days";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Lo que devuelve `POST /api/admin/closed-days/sync` (ver `HolidaySyncSummary`). */
interface SyncSummary {
  created: number;
  refreshed: number;
  failedYears: number[];
  missing: { title: string; date: string }[];
}

/**
 * «Sincronizar feriados»: pide a ArgentinaDatos los feriados nacionales del año en curso y el
 * siguiente y **propone** los que faltan (quedan en «Por revisar», no cierran nada hasta que se
 * confirman). La misma sincronización corre sola una vez por mes.
 */
export function SyncHolidaysButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    setBusy(true);
    try {
      const s = await apiSend<SyncSummary>(
        "/api/admin/closed-days/sync",
        "POST",
      );
      if (s.failedYears.length > 0) {
        toast.warning(
          `No se pudo consultar ${s.failedYears.join(" ni ")}. Probá de nuevo más tarde o cargá los feriados a mano.`,
        );
      }
      if (s.created > 0) {
        toast.success(
          s.created === 1
            ? "Se propuso 1 feriado nuevo: revisalo en «Por revisar»."
            : `Se propusieron ${s.created} feriados nuevos: revisalos en «Por revisar».`,
        );
      } else if (s.failedYears.length === 0) {
        toast.success("Los feriados nacionales ya estaban al día.");
      }
      if (s.missing.length > 0) {
        toast.warning(
          `El origen ya no trae: ${s.missing
            .map((m) => `${m.title} (${formatDateKey(m.date)})`)
            .join(", ")}. Revisá si siguen vigentes.`,
        );
      }
      invalidateApi("/api/admin/closed-days");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo sincronizar los feriados"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={sync} disabled={busy}>
      <RefreshCw
        className={busy ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"}
        aria-hidden
      />
      {busy ? "Sincronizando…" : "Sincronizar feriados"}
    </Button>
  );
}
