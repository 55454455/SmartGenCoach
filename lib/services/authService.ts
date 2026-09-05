import { createClient } from "@/lib/supabase/server";
import type { AuthSession, LoginCredentials, RegisterInput, UserProfile } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadProfile(supabase: SupabaseServerClient, userId: string): Promise<UserProfile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !data) {
    throw new Error("Could not load your profile.");
  }
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    avatarInitials: data.avatar_initials,
    createdAt: data.created_at,
    targetExams: data.target_exams ?? [],
    targetScores: data.target_scores ?? {},
    role: data.role,
  };
}

function toAuthSession(user: UserProfile, session: { access_token: string; expires_at?: number }): AuthSession {
  return {
    user,
    token: session.access_token,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : new Date().toISOString(),
  };
}

// Supabase's client only returns `{ error }` for auth-level failures (wrong password, etc.) —
// a network-level failure (the project unreachable, DNS, a timeout) throws instead, and would
// otherwise surface to the user as a raw message like "fetch failed".
async function guardNetwork<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch {
    throw new Error("Could not reach the authentication service. Please try again in a moment.");
  }
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  const supabase = await createClient();
  const { data, error } = await guardNetwork(supabase.auth.signInWithPassword(credentials));
  if (error || !data.session || !data.user) {
    throw new Error("Incorrect email or password.");
  }
  const profile = await loadProfile(supabase, data.user.id);
  return toAuthSession(profile, data.session);
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const supabase = await createClient();
  const { data, error } = await guardNetwork(
    supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name } },
    }),
  );
  if (error) {
    throw new Error(error.message);
  }
  if (!data.session || !data.user) {
    // Happens when the Supabase project has "Confirm email" enabled (the default) —
    // there's no active session until the user clicks the confirmation link.
    throw new Error("Check your inbox to confirm your email, then sign in.");
  }
  const profile = await loadProfile(supabase, data.user.id);
  return toAuthSession(profile, data.session);
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const profile = await loadProfile(supabase, user.id);
  return toAuthSession(profile, session);
}
