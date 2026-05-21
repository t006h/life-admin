/**
 * Supabase client for Life Admin.
 * Requires @supabase/supabase-js (loaded via CDN in index.html).
 */
(function () {
  const url = window.SUPABASE_URL;
  const anonKey = window.SUPABASE_ANON_KEY;

  function isPlaceholder(value) {
    return (
      typeof value !== "string" ||
      value.length === 0 ||
      value.includes("PASTE_YOUR")
    );
  }

  /** Users often paste the REST URL instead of the Project URL. */
  function normalizeSupabaseUrl(raw) {
    if (typeof raw !== "string") return "";
    const trimmed = raw.trim().replace(/\/+$/, "");
    const match = trimmed.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)/i);
    return match ? match[1] : trimmed;
  }

  function isValidProjectUrl(projectUrl) {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl);
  }

  if (isPlaceholder(url) || isPlaceholder(anonKey)) {
    window.supabaseClient = null;
    window.supabaseConfigError =
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Environment Variables, or run npm run build:config locally.";
    return;
  }

  const projectUrl = normalizeSupabaseUrl(url);

  if (!isValidProjectUrl(projectUrl)) {
    window.supabaseClient = null;
    window.supabaseConfigError =
      "SUPABASE_URL must be your Project URL (e.g. https://xxxx.supabase.co), not a /rest/v1 link. Find it in Supabase → Project Settings → API.";
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    window.supabaseClient = null;
    window.supabaseConfigError =
      "Supabase library failed to load. Serve the app over http://localhost (not file://) and check your network.";
    return;
  }

  try {
    window.supabaseClient = window.supabase.createClient(projectUrl, anonKey.trim());
    window.supabaseConfigError = null;
  } catch (err) {
    window.supabaseClient = null;
    window.supabaseConfigError = `Could not create Supabase client: ${err.message}`;
  }
})();
