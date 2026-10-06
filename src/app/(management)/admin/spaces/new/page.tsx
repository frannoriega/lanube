import { SpaceForm } from "@/components/organisms/admin/config/space-form";
import { requirePagePermission } from "@/lib/page-auth";

/**
 * `?kind=amenity` crea un área común (milestone 24); sin parámetro, un espacio. El tipo no se
 * cambia después, así que se decide acá y no dentro del formulario.
 */
export default async function NewSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await requirePagePermission("spaces:manage");
  const { kind } = await searchParams;
  const amenity = kind === "amenity";
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {amenity ? "Nueva área común" : "Nuevo espacio"}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {amenity
              ? "Creá un área común (cocina, jardín, living…) y configurá su contenido público."
              : "Creá un espacio del centro y configurá su contenido público."}
          </p>
        </div>
      </div>
      <SpaceForm kind={amenity ? "AMENITY" : "SPACE"} />
    </div>
  );
}
