"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FALLBACK_SPACE_ICON,
  getSpaceIcon,
  SPACE_ICON_OPTIONS,
  type SpaceIconName,
} from "@/lib/constants/spaces";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

interface IconPickerProps {
  /** Persisted icon key (a SpaceIconName) or null/"" when unset. */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

/**
 * Grid picker for a space's icon. The trigger previews the current icon; the popover shows the
 * curated {@link SPACE_ICON_OPTIONS} as a selectable grid plus a "Sin icono" clear option
 * (which falls back to the default icon everywhere the space is rendered).
 */
export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const Selected = getSpaceIcon(value);
  const hasIcon = !!value;

  const select = (name: SpaceIconName | null) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
          aria-label="Elegir icono del espacio"
        >
          <span className="flex items-center gap-2">
            <Selected className="h-4 w-4 text-brand-selected dark:text-brand-secondary" />
            <span className={hasIcon ? "" : "text-muted-foreground"}>
              {hasIcon ? (value as string) : "Sin icono (por defecto)"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,90vw)] p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Sin icono"
            aria-pressed={!hasIcon}
            title="Sin icono (por defecto)"
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              !hasIcon
                ? "border-brand-primary bg-brand-primary/10"
                : "border-transparent",
            )}
          >
            <FALLBACK_SPACE_ICON className="h-4 w-4" />
            {!hasIcon && (
              <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-brand-primary" />
            )}
          </button>
          {SPACE_ICON_OPTIONS.map(([name, Icon]) => {
            const active = value === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => select(name)}
                aria-label={name}
                aria-pressed={active}
                title={name}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-md border transition-colors hover:bg-accent hover:text-accent-foreground",
                  active
                    ? "border-brand-primary bg-brand-primary/10 text-brand-selected dark:text-brand-secondary"
                    : "border-transparent text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {active && (
                  <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-brand-primary" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
