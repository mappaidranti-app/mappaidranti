import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { UserProfile, UserRole } from "@/types/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies; middleware refreshes the session.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { user: null, profile: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, municipality_id, created_at")
    .eq("id", user.id)
    .single();

  return { user, profile: profile as UserProfile | null };
}

export async function requireUser() {
  const session = await getCurrentUser();

  if (!session.user) {
    redirect("/login");
  }

  return session as { user: User; profile: UserProfile | null };
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireUser();

  if (!session.profile || !roles.includes(session.profile.role)) {
    redirect("/dashboard");
  }

  return session as { user: User; profile: UserProfile };
}
