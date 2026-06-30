import { Pagination } from "@/components/molecules/pagination";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listFormTemplatesPage } from "@/lib/db/forms";
import Link from "next/link";

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { templates, total, pageSize } = await listFormTemplatesPage({ page });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Formularios</h1>
        <Button asChild>
          <Link href="/admin/forms/new">Nuevo formulario</Link>
        </Button>
      </div>

      {total === 0 ? (
        <p className="text-muted-foreground">
          Todavía no hay formularios. Creá uno y usalo al crear un evento.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <Link key={tpl.id} href={`/admin/forms/${tpl.id}`}>
                <Card className="h-full transition-colors hover:border-la-nube-primary">
                  <CardHeader>
                    <CardTitle>{tpl.name}</CardTitle>
                    {tpl.description && (
                      <CardDescription>{tpl.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {tpl._count.fields} campo
                    {tpl._count.fields === 1 ? "" : "s"}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            basePath="/admin/forms"
          />
        </>
      )}
    </div>
  );
}
