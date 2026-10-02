/**
 * Cifras del ecosistema educativo y tecnológico de Concepción del Uruguay (2026), tomadas del
 * Plan Estratégico (la fuente autoritativa del copy institucional, `assets/`).
 *
 * Antes vivían sólo en "Quiénes somos" (`StatTile` sueltos en la página). Desde el milestone 17
 * también se muestran en la landing, en una franja propia (`StatsBand`); por eso están acá, en
 * un único lugar: si cambia un número, cambia en las dos páginas.
 *
 * `value` es el número que se anima al entrar en pantalla; `prefix` va antes ("+130").
 */
export interface EcosystemStat {
  value: number;
  prefix?: string;
  label: string;
}

export const ECOSYSTEM_STATS: EcosystemStat[] = [
  { value: 4, label: "Universidades · UNER, UCU, UTN y UADER" },
  { value: 130, prefix: "+", label: "Carreras superiores" },
  { value: 250, prefix: "+", label: "Profesionales SSI" },
  { value: 25, prefix: "+", label: "Empresas SSI con representación local" },
];
