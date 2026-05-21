/**
 * Life Admin — load user from public.users (or dev config fallback).
 */
(function () {
  const USERS_TABLE = "users";
  const { ROLES, PLANS, setUserContext } = window.LifeAdminAccess;

  function devContextFromConfig() {
    const role =
      typeof window.DEV_USER_ROLE === "string" ? window.DEV_USER_ROLE : ROLES.USER;
    const plan =
      typeof window.DEV_USER_PLAN === "string" ? window.DEV_USER_PLAN : PLANS.FREE;
    const fullName =
      typeof window.DEV_USER_FULL_NAME === "string" ? window.DEV_USER_FULL_NAME : "Dev User";
    const email =
      typeof window.DEV_USER_EMAIL === "string" ? window.DEV_USER_EMAIL : "dev@lifeadmin.local";
    return {
      role,
      plan,
      userId: null,
      email,
      fullName,
      source: "dev",
    };
  }

  async function loadUserFromSupabase() {
    const client = window.supabaseClient;
    if (!client || !client.auth) return null;

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    const session = sessionData?.session;
    if (!session?.user) return null;

    const { data, error } = await client
      .from(USERS_TABLE)
      .select("id, email, full_name, role, plan, created_at")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return {
        role: data.role,
        plan: data.plan,
        userId: data.id,
        email: data.email,
        fullName: data.full_name,
        createdAt: data.created_at,
        source: "supabase",
      };
    }

    return {
      role: ROLES.USER,
      plan: PLANS.FREE,
      userId: session.user.id,
      email: session.user.email || "",
      fullName: session.user.user_metadata?.full_name || "",
      source: "session_default",
    };
  }

  async function initUserContext() {
    let ctx = devContextFromConfig();

    try {
      const remote = await loadUserFromSupabase();
      if (remote && !window.DEV_PREFER_CONFIG) ctx = remote;
    } catch (err) {
      console.warn("User load failed, using dev/default context:", err);
    }

    window.LifeAdminProductAnalytics?.trackSignupOnce?.({ source: ctx.source });
    window.LifeAdminProductAnalytics?.trackDailyActive?.();

    setUserContext({
      role: ctx.role,
      plan: ctx.plan,
      userId: ctx.userId,
      email: ctx.email,
      fullName: ctx.fullName,
    });

    return ctx;
  }

  window.LifeAdminProfile = {
    USERS_TABLE,
    initUserContext,
    devContextFromConfig,
    loadUserFromSupabase,
    loadProfileFromSupabase: loadUserFromSupabase,
  };
})();
