import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

export function StatusIcon({ status, className = "h-4 w-4" }: { status: string; className?: string }) {
  switch (status) {
    case "APPROVED":
      return <CheckCircle className={`${className} text-green-500`} />;
    case "REJECTED":
      return <XCircle className={`${className} text-red-500`} />;
    case "PENDING":
      return <Clock className={`${className} text-yellow-500`} />;
    default:
      return <AlertCircle className={`${className} text-gray-500`} />;
  }
}


