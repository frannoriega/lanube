import type { UserPolicyDetail } from "@/lib/db/users";

export type AdminUser = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  dni?: string | null;
  institution?: string | null;
  /** Display name of the assigned role; null on the base tier. */
  role: string | null;
  roleId: string | null;
  createdAt: number;
  status?: "ACTIVE" | "INACTIVE" | string | null;
  /** Milestone 19: si aceptó las políticas vigentes (misma regla que el gate). */
  policies: "UP_TO_DATE" | "PENDING";
  /** Detalle para la tarjeta de la columna «Políticas» (milestone 29). */
  policyDetail: UserPolicyDetail;
};
