"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FIELD_TYPE_ICONS, fieldTypeLabel } from "@/lib/constants/form-fields";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, FileText, Search } from "lucide-react";
import { useState } from "react";

export interface FormPickerField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export interface FormPickerTemplate {
  id: string;
  name: string;
  description?: string | null;
  fields: FormPickerField[];
}

interface FormPickerProps {
  templates: FormPickerTemplate[];
  /** Selected template id, or null for "no form". */
  value: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Searchable form-template picker. Opens a dialog with a search box and a card per
 * template previewing its fields. Built on shadcn Command (cmdk) for fuzzy filtering.
 */
export function FormPicker({ templates, value, onSelect }: FormPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = templates.find((t) => t.id === value) ?? null;

  const choose = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected ? selected.name : "Sin formulario"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-3 pt-6">
          <DialogTitle>Elegí un formulario</DialogTitle>
          <DialogDescription>
            Buscá una plantilla y previsualizá sus campos. Se clonará una copia
            para este evento.
          </DialogDescription>
        </DialogHeader>
        <Command className="border-t" loop>
          <CommandInput placeholder="Buscar formulario…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>
              <span className="flex flex-col items-center gap-1 py-6 text-muted-foreground">
                <Search className="h-5 w-5" />
                No se encontraron formularios.
              </span>
            </CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="sin-formulario ninguno"
                onSelect={() => choose(null)}
                className="gap-2"
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    value === null ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="text-sm">Sin formulario</span>
              </CommandItem>
            </CommandGroup>

            {templates.length > 0 && (
              <CommandGroup heading="Plantillas">
                {templates.map((tpl) => (
                  <CommandItem
                    key={tpl.id}
                    value={`${tpl.name} ${tpl.description ?? ""} ${tpl.fields
                      .map((f) => `${f.label} ${fieldTypeLabel(f.type)}`)
                      .join(" ")}`}
                    onSelect={() => choose(tpl.id)}
                    className="flex-col items-stretch gap-2 rounded-lg border border-transparent p-3 data-[selected=true]:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {tpl.name}
                        </p>
                        {tpl.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {tpl.description}
                          </p>
                        )}
                      </div>
                      {value === tpl.id && (
                        <Check className="h-4 w-4 shrink-0 text-brand-primary" />
                      )}
                    </div>
                    <FieldPreview fields={tpl.fields} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

const MAX_PREVIEW_CHIPS = 6;

function FieldPreview({ fields }: { fields: FormPickerField[] }) {
  if (fields.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Sin campos.</p>;
  }
  const shown = fields.slice(0, MAX_PREVIEW_CHIPS);
  const rest = fields.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((f) => {
        const Icon = FIELD_TYPE_ICONS[f.type] ?? FileText;
        return (
          <Badge
            key={f.id}
            variant="secondary"
            className="max-w-[12rem] gap-1 font-normal"
            title={`${f.label} · ${fieldTypeLabel(f.type)}`}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{f.label}</span>
          </Badge>
        );
      })}
      {rest > 0 && (
        <Badge variant="outline" className="font-normal">
          +{rest}
        </Badge>
      )}
    </div>
  );
}
