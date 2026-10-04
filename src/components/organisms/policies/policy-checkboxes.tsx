"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { SubmittedAcceptance } from "@/lib/policies/pending";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

/** Lo que hace falta de una política para pedir que se acepte. */
export interface PolicyToAccept {
  key: string;
  version: string;
  title: string;
  slug: string;
}

/**
 * Un checkbox **por política** (milestone 19), sin tildar, con el título enlazado a la versión
 * exacta que se está aceptando (abre en otra pestaña, así no se pierde lo cargado).
 *
 * Uno por política y no uno global: la Ley 25.326 pide un consentimiento "libre, expreso e
 * informado", y con más de una política, tildarlas por separado es lo defendible.
 *
 * Controlado: `value` es la lista de `{ key, version }` tildadas, que es exactamente lo que
 * se manda al servidor.
 */
export function PolicyCheckboxes({
  policies,
  value,
  onChange,
  disabled,
  className,
}: {
  policies: readonly PolicyToAccept[];
  value: readonly SubmittedAcceptance[];
  onChange: (next: SubmittedAcceptance[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const isChecked = (p: PolicyToAccept) =>
    value.some((v) => v.key === p.key && v.version === p.version);

  const toggle = (p: PolicyToAccept, checked: boolean) => {
    const rest = value.filter((v) => v.key !== p.key);
    onChange(checked ? [...rest, { key: p.key, version: p.version }] : rest);
  };

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {policies.map((p) => {
        const id = `accept-policy-${p.key}`;
        return (
          <li key={p.key} className="flex items-start gap-3">
            <Checkbox
              id={id}
              checked={isChecked(p)}
              disabled={disabled}
              onCheckedChange={(c) => toggle(p, c === true)}
              className="mt-0.5"
            />
            <label htmlFor={id} className="text-sm leading-snug">
              Leí y acepto la{" "}
              <a
                href={`/policies/${p.slug}/versions/${p.version}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
              >
                {p.title.toLowerCase()}
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** Si están tildadas todas las políticas de la lista, cada una en su versión. */
export function allPoliciesChecked(
  policies: readonly PolicyToAccept[],
  value: readonly SubmittedAcceptance[],
): boolean {
  return policies.every((p) =>
    value.some((v) => v.key === p.key && v.version === p.version),
  );
}
