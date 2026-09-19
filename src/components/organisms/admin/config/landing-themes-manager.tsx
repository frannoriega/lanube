"use client";

import { DateRangePicker } from "@/components/molecules/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import { endOfDateKeyMs, startOfDateKeyMs } from "@/lib/admin/admin-timezone";
import {
  landingThemeInputSchema,
  type LandingThemeInput,
} from "@/lib/schemas/config";
import type { LandingTheme } from "@/types/prisma";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const EMPTY: LandingThemeInput = {
  name: "",
  isEnabled: true,
  priority: 0,
  recurring: true,
  startMonthDay: "",
  endMonthDay: "",
  startDate: null,
  endDate: null,
  entranceEffect: "EMOJI_SHOWER",
  emojiList: "🎉 🎊",
  particleCount: 40,
  heroEyebrowOverride: "",
  heroKeywords: "",
  heroKeywordsMode: "APPEND",
};

function themeToFormValues(t: LandingTheme): LandingThemeInput {
  return {
    name: t.name,
    isEnabled: t.isEnabled,
    priority: t.priority,
    recurring: t.recurring,
    startMonthDay: t.startMonthDay ?? "",
    endMonthDay: t.endMonthDay ?? "",
    startDate: t.startDate == null ? null : Number(t.startDate),
    endDate: t.endDate == null ? null : Number(t.endDate),
    entranceEffect: t.entranceEffect,
    emojiList: t.emojiList ?? "",
    particleCount: t.particleCount ?? 40,
    heroEyebrowOverride: t.heroEyebrowOverride ?? "",
    heroKeywords: t.heroKeywords ?? "",
    heroKeywordsMode: t.heroKeywordsMode,
  };
}

/** "yyyy-MM-dd" key (DateRangePicker's format) from a ms timestamp, or undefined. */
function msToDateKey(ms: number | null | undefined): string | undefined {
  if (ms == null) return undefined;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function windowSummary(t: LandingTheme): string {
  if (t.recurring) {
    return `${t.startMonthDay ?? "?"} — ${t.endMonthDay ?? "?"} (cada año)`;
  }
  if (t.startDate == null || t.endDate == null) return "Sin definir";
  const fmt = (ms: number) => new Date(ms).toLocaleDateString("es-AR");
  return `${fmt(t.startDate)} — ${fmt(t.endDate)}`;
}

export function LandingThemesManager() {
  const { data, firstTime, refetch } =
    useApi<LandingTheme[]>("/api/admin/themes");
  const themes = data ?? [];
  const [editing, setEditing] = useState<LandingTheme | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<LandingTheme | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<LandingThemeInput>({
    resolver: zodResolver(landingThemeInputSchema),
    defaultValues: EMPTY,
  });

  const recurring = form.watch("recurring");
  const entranceEffect = form.watch("entranceEffect");

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (theme: LandingTheme) => {
    setEditing(theme);
    form.reset(themeToFormValues(theme));
    setDialogOpen(true);
  };

  const onSubmit = async (values: LandingThemeInput) => {
    setBusy(true);
    try {
      if (editing) {
        await apiSend(`/api/admin/themes/${editing.id}`, "PUT", values);
        toast.success("Tema actualizado");
      } else {
        await apiSend("/api/admin/themes", "POST", values);
        toast.success("Tema creado");
      }
      setDialogOpen(false);
      invalidateApi("/api/admin/themes");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar el tema"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/themes/${deleting.id}`, "DELETE");
      toast.success("Tema eliminado");
      setDeleting(null);
      invalidateApi("/api/admin/themes");
      await refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo eliminar el tema"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Temas configurados</CardTitle>
          <CardDescription>
            Cada tema define cuándo se activa y qué cambia en la portada
            mientras dura.
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo tema
        </Button>
      </CardHeader>
      <CardContent>
        {firstTime ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ventana</TableHead>
                <TableHead>Efecto</TableHead>
                <TableHead className="w-24">Prioridad</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {themes.map((theme) => (
                <TableRow key={theme.id}>
                  <TableCell className="font-medium">{theme.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {windowSummary(theme)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {theme.entranceEffect === "EMOJI_SHOWER"
                        ? "Lluvia de emojis"
                        : "Ninguno"}
                    </Badge>
                  </TableCell>
                  <TableCell>{theme.priority}</TableCell>
                  <TableCell>
                    <Badge variant={theme.isEnabled ? "default" : "secondary"}>
                      {theme.isEnabled ? "Activo" : "Deshabilitado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(theme)}
                      aria-label={`Editar ${theme.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(theme)}
                      aria-label={`Eliminar ${theme.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {themes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No hay temas definidos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tema" : "Nuevo tema"}</DialogTitle>
            <DialogDescription>
              Los colores y textos disponibles están acotados a lo que ya usa la
              marca — no es un editor de estilos libre.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Aniversario" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                      <FormLabel className="mb-0">Habilitado</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(
                              Number.isNaN(e.target.valueAsNumber)
                                ? 0
                                : e.target.valueAsNumber,
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Si dos ventanas se superponen, gana la mayor.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="recurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel className="mb-0">
                        Se repite todos los años
                      </FormLabel>
                      <FormDescription>
                        Ej: aniversario, fin de año. Si no, elegí un rango de
                        fechas puntual.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {recurring ? (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startMonthDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desde (MM-DD)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="09-25"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endMonthDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hasta (MM-DD)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="09-25"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <FormItem>
                  <FormLabel>Rango de fechas</FormLabel>
                  <DateRangePicker
                    value={{
                      from: msToDateKey(form.watch("startDate")),
                      to: msToDateKey(form.watch("endDate")),
                    }}
                    onChange={(range) => {
                      form.setValue(
                        "startDate",
                        range.from ? startOfDateKeyMs(range.from) : null,
                        { shouldValidate: true },
                      );
                      form.setValue(
                        "endDate",
                        range.to ? endOfDateKeyMs(range.to) : null,
                        { shouldValidate: true },
                      );
                    }}
                    clearable
                  />
                  <FormMessage>
                    {form.formState.errors.startDate?.message ??
                      form.formState.errors.endDate?.message}
                  </FormMessage>
                </FormItem>
              )}

              <FormField
                control={form.control}
                name="entranceEffect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Efecto al entrar</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NONE">Ninguno</SelectItem>
                        <SelectItem value="EMOJI_SHOWER">
                          Lluvia de emojis
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Se muestra una vez por visitante por día, mientras el tema
                      esté activo.
                    </FormDescription>
                  </FormItem>
                )}
              />

              {entranceEffect === "EMOJI_SHOWER" ? (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="emojiList"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emojis</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="🎉 🎊 🥳"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Separados por espacio.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="particleCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={5}
                            max={150}
                            value={field.value ?? 40}
                            onChange={(e) =>
                              field.onChange(
                                Number.isNaN(e.target.valueAsNumber)
                                  ? 40
                                  : e.target.valueAsNumber,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="heroEyebrowOverride"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Línea sobre el título (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="🎉 Celebrando nuestro aniversario"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Reemplaza &ldquo;Una iniciativa de Concepción del
                      Uruguay&rdquo; mientras el tema esté activo.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heroKeywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Palabras para la rotación del título (opcional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="10 años, celebración, fiesta"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Separadas por coma. Se combinan con la rotación de
                      &ldquo;un espacio de …&rdquo; del inicio según la opción
                      de abajo.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heroKeywordsMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cómo combinarlas</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="APPEND">
                          Agregar a las palabras habituales
                        </SelectItem>
                        <SelectItem value="REPLACE">
                          Reemplazar las palabras habituales
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      &ldquo;Reemplazar&rdquo; solo aplica mientras el tema esté
                      activo; después vuelven las palabras de siempre.
                    </FormDescription>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {editing ? "Guardar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
