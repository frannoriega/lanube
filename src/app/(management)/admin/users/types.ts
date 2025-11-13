export type AdminUser = {
  id: string
  name: string | null
  lastName: string | null
  email: string
  dni?: string | null
  institution?: string | null
  role: string
  createdAt: string
  status?: "ACTIVE" | "INACTIVE" | string | null
}


