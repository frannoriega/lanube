"use client";

/**
 * Selector de **mes + día** sin año (valor `"MM-DD"`), para ventanas que se repiten todos los
 * años — p. ej. los temas del landing ("del 20-09 al 30-09, cada año").
 *
 * Milestone 14 (Part B.4, "control correcto por tipo de dato"): antes era un input de texto
 * libre con placeholder "MM-DD", que obligaba a saber el formato y aceptaba cualquier cosa
 * hasta el submit. Dos selects (Mes, Día) hacen imposible un valor mal formado; los días se
 * acotan al mes elegido (29 en febrero, porque una ventana anual puede incluir el 29 de los
 * años bisiestos).
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Días máximos por mes (febrero con 29: ver docblock). */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const pad = (n: number) => String(n).padStart(2, "0");

export function MonthDayPicker({
  value,
  onChange,
  ariaLabel,
}: {
  /** `"MM-DD"` o vacío. */
  value: string;
  onChange: (value: string) => void;
  /** Prefijo para los rótulos accesibles ("Desde" → "Desde: mes", "Desde: día"). */
  ariaLabel: string;
}) {
  const [mm, dd] = /^\d{2}-\d{2}$/.test(value) ? value.split("-") : ["", ""];
  const month = mm ? Number(mm) : 0;
  const maxDay = month ? DAYS_IN_MONTH[month - 1] : 31;

  return (
    <div className="flex gap-2">
      <Select
        value={mm}
        onValueChange={(m) => {
          // Si el día elegido no existe en el mes nuevo (31 → abril), se recorta al último.
          const last = DAYS_IN_MONTH[Number(m) - 1];
          const day = dd ? Math.min(Number(dd), last) : 1;
          onChange(`${m}-${pad(day)}`);
        }}
      >
        <SelectTrigger
          className="w-full min-w-0"
          aria-label={`${ariaLabel}: mes`}
        >
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={pad(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={dd} onValueChange={(d) => onChange(`${mm || "01"}-${d}`)}>
        <SelectTrigger
          className="w-24 shrink-0"
          aria-label={`${ariaLabel}: día`}
        >
          <SelectValue placeholder="Día" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {Array.from({ length: maxDay }, (_, i) => pad(i + 1)).map((d) => (
            <SelectItem key={d} value={d}>
              {Number(d)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
