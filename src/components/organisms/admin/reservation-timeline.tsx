"use client";

import { useServerTime } from "@/components/providers/server-time";
import { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import { formatTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Fragment, useMemo, useState } from "react";

const SLOT_MINUTES = 15;
const SLOT_WIDTH_PX = 24;

function roundToSlot(date: Date, roundDown: boolean): Date {
  const d = new Date(date);
  const mins = d.getMinutes();
  const remainder = mins % SLOT_MINUTES;
  d.setMinutes(roundDown ? mins - remainder : mins + (remainder ? SLOT_MINUTES - remainder : 0));
  d.setSeconds(0, 0);
  return d;
}

function getSlotsBetween(start: Date, end: Date): Date[] {
  const slots: Date[] = [];
  const s = roundToSlot(start, true);
  const e = roundToSlot(end, false);
  const cur = new Date(s);
  while (cur.getTime() < e.getTime()) {
    slots.push(new Date(cur));
    cur.setMinutes(cur.getMinutes() + SLOT_MINUTES);
  }
  return slots;
}

function positionOnTimeline(
  reservation: AdminReservationListResult,
  timelineStart: Date
): { startBlock: number; spanBlocks: number } {
  const start = new Date(reservation.startTime).getTime();
  const end = new Date(reservation.endTime).getTime();
  const tStart = timelineStart.getTime();
  const blockSize = SLOT_MINUTES * 60 * 1_000;
  const startBlock = Math.max(0, Math.floor((start - tStart) / blockSize));
  const spanBlocks = Math.max(1, Math.floor((end - start) / blockSize));
  return { startBlock, spanBlocks };
}

const HEADER_HEIGHT = 44;

export function ReservationTimeline({
  reservations,
  onAction,
  processing,
  showActions = true,
}: {
  reservations: AdminReservationListResult[];
  onAction?: (id: string, action: "APPROVED" | "REJECTED", reason?: string) => void;
  processing?: string | null;
  showActions?: boolean;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [reasonModalReservation, setReasonModalReservation] =
    useState<AdminReservationListResult | null>(null);
  const { now } = useServerTime();
  const { timelineStart, slots, displaySlots } = useMemo(() => {
    const baseDate =
      reservations.length > 0 ? new Date(reservations[0].startTime) : now();
    const start = new Date(baseDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(18, 0, 0, 0);
    const slots = getSlotsBetween(start, end);
    const displaySlots = [...slots, new Date(end)];
    return { timelineStart: start, slots, displaySlots };
  }, [reservations, now]);

  const gridCols = showActions && onAction
    ? "128px 1fr 140px"
    : "128px 1fr";

  return (
    <div className="w-full overflow-hidden">
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: `${HEADER_HEIGHT}px repeat(${reservations.length}, auto)`,
        }}
      >
        {/* Row 0: Header - empty | calendar header | empty */}
        <div className="border-b border-r border-gray-200 dark:border-gray-700" style={{ gridRow: 1, gridColumn: 1 }} />
        <div
          className="border-b border-gray-200 dark:border-gray-800 overflow-x-auto overflow-y-hidden min-w-0"
          style={{
            gridRow: "1 / -1",
            gridColumn: 2,
            display: "grid",
            gridTemplateRows: "subgrid",
            gridTemplateColumns: `repeat(${displaySlots.length}, ${SLOT_WIDTH_PX}px)`,
            paddingLeft: 56,
            paddingRight: 56,
          }}
        >
          <>
            {/* Calendar header row - times at division lines, no background */}
            {displaySlots.map((slot, i) => (
              <div
                key={`h-${i}`}
                className="flex flex-col border-r border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 overflow-visible"
                style={{
                  width: SLOT_WIDTH_PX,
                  minWidth: SLOT_WIDTH_PX,
                  gridColumn: i + 1,
                  gridRow: 1,
                }}
              >
                <div className="flex-1 flex items-center justify-start min-h-0 overflow-visible">
                  {i % 4 === 0 ? (
                    <span
                      className="whitespace-nowrap"
                      style={{ transform: "translateX(-50%)" }}
                    >
                      {formatTime(slot)}
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "w-full border-t border-gray-200 dark:border-gray-700 shrink-0",
                    i % 4 === 0 && "border-l-2 border-l-gray-300 dark:border-l-gray-600"
                  )}
                  style={{ height: "25%" }}
                />
              </div>
            ))}

            {/* Calendar content rows - 15-min blocks with background */}
            {reservations.map((r, rowIdx) => {
              const { startBlock, spanBlocks } = positionOnTimeline(r, timelineStart);
              const blockColumns = displaySlots.length;
              const leftPct = (startBlock / blockColumns) * 100;
              const widthPct = (spanBlocks / blockColumns) * 100;

              return (
                <Fragment key={r.id}>
                  {displaySlots.map((_, i) => (
                    <div
                      key={`b-${r.id}-${i}`}
                      className={cn(
                        i % 4 === 0 && "border-l-2 border-l-gray-300 dark:border-l-gray-600",
                        i < slots.length
                          ? "border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
                          : "bg-transparent"
                      )}
                      style={{
                        width: SLOT_WIDTH_PX,
                        minWidth: SLOT_WIDTH_PX,
                        gridColumn: i + 1,
                        gridRow: rowIdx + 2,
                        minHeight: 32,
                      }}
                    />
                  ))}
                  {/* Event overlay - positioned by block index for exact alignment */}
                  <div
                    className="relative py-1.5 px-0 col-start-1 col-end-[-1]"
                    style={{ gridRow: rowIdx + 2, gridColumn: "1 / -1", minHeight: 0 }}
                  >
                    <button
                      type="button"
                      className={cn(
                        "absolute top-1 bottom-1 left-0 rounded px-1 flex items-center text-xs text-left cursor-pointer z-10",
                        r.status === "PENDING" && "bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-900/70",
                        r.status === "APPROVED" && "bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-100 hover:bg-green-300 dark:hover:bg-green-900/70",
                        r.status === "REJECTED" && "bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 hover:bg-red-300 dark:hover:bg-red-900/70"
                      )}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        minWidth: widthPct < 5 ? "20px" : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setReasonModalReservation(r);
                      }}
                      title={r.reason}
                    >
                      {widthPct > 10 ? (
                        <span className="block overflow-hidden truncate">
                          {r.reason}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </Fragment>
              );
            })}
          </>
        </div>
        {showActions && onAction && (
          <div className="border-b border-l border-gray-200 dark:border-gray-700" style={{ gridRow: 1, gridColumn: 3 }} />
        )}

        {/* Content rows: name | (calendar spans) | actions */}
        {reservations.map((r, idx) => {
          const userName = `${r.registeredUser.name} ${r.registeredUser.lastName}`;

          return (
            <Fragment key={r.id}>
              <div
                className="border-b border-r border-gray-100 dark:border-gray-800 py-1.5 pr-2 flex items-center"
                style={{ gridRow: idx + 2, gridColumn: 1 }}
              >
                <span className="text-sm font-medium truncate block" title={userName}>
                  {userName}
                </span>
              </div>
              {showActions && onAction && (
                <div
                  className="flex flex-col gap-1 py-1.5 pl-2 border-b border-l border-gray-100 dark:border-gray-800"
                  style={{ gridRow: idx + 2, gridColumn: 3 }}
                >
                  {r.status === "PENDING" ? (
                    rejectingId !== r.id ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          onClick={() => onAction(r.id, "APPROVED")}
                          disabled={processing === r.id}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          onClick={() => setRejectingId(r.id)}
                          disabled={processing === r.id}
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <textarea
                          className="text-xs w-full min-h-[60px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5"
                          placeholder="Motivo del rechazo"
                          value={denyReason}
                          onChange={(e) => setDenyReason(e.target.value)}
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={() => {
                              setRejectingId(null);
                              setDenyReason("");
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              onAction(r.id, "REJECTED", denyReason);
                              setRejectingId(null);
                              setDenyReason("");
                            }}
                            disabled={!denyReason.trim() || processing === r.id}
                          >
                            Confirmar rechazo
                          </button>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <Dialog
        open={!!reasonModalReservation}
        onOpenChange={(open) => !open && setReasonModalReservation(null)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {reasonModalReservation
                ? `${reasonModalReservation.registeredUser.name} ${reasonModalReservation.registeredUser.lastName}`
                : "Motivo de la reserva"}
            </DialogTitle>
          </DialogHeader>
          <div
            className="max-h-[min(60vh,400px)] overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-3 text-sm whitespace-pre-line break-words"
            role="region"
            aria-label="Motivo de la reserva"
          >
            {reasonModalReservation?.reason ?? ""}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
