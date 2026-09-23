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
};
