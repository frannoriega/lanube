import {
  SpaceForm,
  type SpaceEditable,
} from "@/components/organisms/admin/config/space-form";
import { Button } from "@/components/ui/button";
import { getSpaceById, getSpaceFaqs } from "@/lib/db/spaces";
import { requirePagePermission } from "@/lib/page-auth";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditSpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("spaces:manage");
  const { id } = await params;
  const space = await getSpaceById(id);
  if (!space) notFound();

  // Narrow to the editable, BigInt-free shape so it is serializable to the client form.
  const editable: SpaceEditable = {
    id: space.id,
    name: space.name,
    slug: space.slug,
    description: space.description,
    longDescription: space.longDescription,
    faqs: getSpaceFaqs(space),
    capacity: space.capacity,
    isExclusive: space.isExclusive,
    isReservable: space.isReservable,
    isFeatured: space.isFeatured,
    displayOrder: space.displayOrder,
    iconName: space.iconName,
    imageUrl: space.imageUrl,
  };

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
            Editar espacio
          </h1>
          <p className="text-gray-600 dark:text-gray-300">{space.name}</p>
        </div>
      </div>
      <SpaceForm space={editable} />
    </div>
  );
}
