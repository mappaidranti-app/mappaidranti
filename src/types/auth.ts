export type UserRole = "super_admin" | "client_admin" | "surveyor";

export type Municipality = {
  id: string;
  name: string;
  province: string | null;
  region: string | null;
  created_at?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  municipality_id: string | null;
  created_at?: string;
};
