import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge className="bg-green-100 text-green-800">Aprobada</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-800">Rechazada</Badge>;
    case "PENDING":
      return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
    case "CANCELLED":
      return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
  }
}


