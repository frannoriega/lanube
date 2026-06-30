"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CopyFieldProps {
  /** The text copied to the clipboard (and shown, in the box variant). */
  value: string;
  /** Optional label rendered above the box variant. */
  label?: string;
  /**
   * - "box": read-only input + copy icon button (good for URLs/tokens).
   * - "button": a single labelled copy button (good inside cards / tight spaces).
   */
  variant?: "box" | "button";
  /** Label for the button variant. */
  buttonLabel?: string;
  /** Toast message on success. */
  successMessage?: string;
  /** Render the value in a monospace font (box variant). */
  mono?: boolean;
  className?: string;
}

/**
 * Reusable copy-to-clipboard control for any text value (URLs, tokens, codes, …).
 * Shows a transient check + toast on success. Stops click propagation so it can live
 * inside clickable cards/links without triggering navigation.
 */
export function CopyField({
  value,
  label,
  variant = "box",
  buttonLabel = "Copiar",
  successMessage = "Copiado",
  mono = false,
  className,
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const Icon = copied ? Check : Copy;

  if (variant === "button") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        className={className}
      >
        <Icon className="h-4 w-4" />
        {buttonLabel}
      </Button>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={cn("text-sm", mono && "font-mono")}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copy}
          aria-label={buttonLabel}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
