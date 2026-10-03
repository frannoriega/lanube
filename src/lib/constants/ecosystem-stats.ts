/**
 * Cifras del ecosistema educativo y tecnológico de Concepción del Uruguay (2026), tomadas del
 * Plan Estratégico (la fuente autoritativa del copy institucional, `assets/`).
 *
 * Se muestran en "Quiénes somos" con `StatsBand`. Durante el milestone 18 también estuvieron
 * en la landing; se quitaron tras revisarlo con el usuario (son cifras de la ciudad, no de La Nube). Siguen en un archivo
 * propio para que el número viva en un solo lugar si vuelven a usarse en otra página.
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
