/**
 * Supabase client for Life Admin.
 * Requires @supabase/supabase-js (loaded via CDN in index.html).
 */
(function () {
  const url = window.SUPABASE_URL;
  const anonKey = window.SUPABASE_ANON_KEY;

  function isConfigured(value) {
    return (
      typeof value === "string" &&
      value.length > 0 &&
      !value.includes("PASTE_YOUR")
    );
  }

  if (!isConfigured(url) || !isConfigured(anonKey)) {
    window.supabaseClient = null;
    window.supabaseConfigError =
      "Add your Supabase URL and anon key in frontend/config.js";
    return;
  }

  window.supabaseClient = window.supabase.createClient(url, anonKey);
  window.supabaseConfigError = null;
})();
