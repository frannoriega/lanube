"use client";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ADMIN_RESOURCE_SERVICE_OPTIONS,
  type AdminResourceServiceSlug,
} from "@/lib/admin/admin-resource-service-slug";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

export function AdminResourceTypeCombobox({
  value,
  onChange,
  className,
  disabled,
}: {
  value: AdminResourceServiceSlug;
  onChange: (v: AdminResourceServiceSlug) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label =
    ADMIN_RESOURCE_SERVICE_OPTIONS.find((o) => o.slug === value)?.label ??
    value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between sm:w-[280px]", className)}
        >
          {label}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tipo…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {ADMIN_RESOURCE_SERVICE_OPTIONS.map((opt) => (
                <CommandItem
                  key={opt.slug}
                  value={`${opt.label} ${opt.slug}`}
                  onSelect={() => {
                    onChange(opt.slug);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.slug ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
