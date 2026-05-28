"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import React, { useCallback } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ThemeToggleProps extends React.ComponentPropsWithoutRef<
  typeof Button
> {
  toggleMode?: boolean;
}

export function ThemeToggle({
  className,
  toggleMode = false,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const cns = cn("w-9 px-0", className);

  const toggleSetValue = useCallback(
    (value: string) => {
      if (value === "light") {
        setTheme("light");
      } else if (value === "dark") {
        setTheme("dark");
      }
    },
    [setTheme],
  );

  if (toggleMode) {
    return (
      <ToggleGroup
        type="single"
        value={resolvedTheme}
        onValueChange={toggleSetValue}
        className="dark:bg-slate-800 bg-slate-400"
      >
        <ToggleGroupItem
          value="light"
          className="data-[state=on]:bg-slate-300 dark:data-[state=on]:bg-blue-600"
        >
          <Sun />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          className="data-[state=on]:bg-slate-400 dark:data-[state=on]:bg-slate-600"
        >
          <Moon />
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cns}>
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
