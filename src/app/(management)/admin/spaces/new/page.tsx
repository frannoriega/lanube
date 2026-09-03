import { SpaceForm } from "@/components/organisms/admin/config/space-form";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/page-auth";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewSpacePage() {
  await requirePagePermission("spaces:manage");
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 text-muted-foreground"
        >
          <Link href="/admin/spaces">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver a espacios
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nuevo espacio
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Creá un espacio del centro y configurá su contenido público.
          </p>
        </div>
      </div>
      <SpaceForm />
    </div>
  );
}
