/**
 * Life Admin — product analytics (signups, DAU, feature usage)
 * Queues locally and flushes to Supabase when configured.
 */
(function () {
  const QUEUE_KEY = "life_admin_analytics_queue";
  const DAU_KEY_PREFIX = "life_admin_dau_";
  const SIGNUP_KEY = "life_admin_signup_tracked";
  const SESSION_KEY = "life_admin_session_id";

  const EVENTS = Object.freeze({
    SIGNUP: "signup",
    DAILY_ACTIVE: "daily_active",
    REMINDER_CREATED: "reminder_created",
    TASK_CREATED: "task_created",
    VAULT_UPLOAD: "vault_upload",
    AI_USAGE: "ai_usage",
    UPGRADE_CLICK: "upgrade_click",
  });

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function readQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeQueue(items) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-200)));
    } catch (e) {
      console.warn("Analytics queue:", e.message);
    }
  }

  function getUserId() {
    return window.LifeAdminAccess?.getUserContext?.()?.userId || null;
  }

  function track(eventName, properties = {}) {
    if (!eventName) return;
    const row = {
      event_name: eventName,
      properties: { ...properties, path: location.pathname, at: new Date().toISOString() },
      session_id: getSessionId(),
      user_id: getUserId(),
      created_at: new Date().toISOString(),
    };
    const q = readQueue();
    q.push(row);
    writeQueue(q);
    flushQueue().catch((e) => console.warn("Analytics flush:", e.message));
  }

  async function flushQueue() {
    const client = window.supabaseClient;
    if (!client) return;
    const q = readQueue();
    if (!q.length) return;

    const batch = q.slice(0, 25).map((e) => ({
      user_id: e.user_id || getUserId(),
      event_name: e.event_name,
      properties: e.properties || {},
      session_id: e.session_id || getSessionId(),
      created_at: e.created_at || new Date().toISOString(),
    }));

    const { error } = await client.from("product_analytics_events").insert(batch);
    if (error) throw error;
    writeQueue(q.slice(batch.length));
  }

  function trackDailyActive() {
    const key = DAU_KEY_PREFIX + todayKey();
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    track(EVENTS.DAILY_ACTIVE, { date: todayKey() });
  }

  function trackSignupOnce(meta = {}) {
    if (localStorage.getItem(SIGNUP_KEY)) return;
    localStorage.setItem(SIGNUP_KEY, "1");
    track(EVENTS.SIGNUP, meta);
  }

  function trackReminderCreated(meta = {}) {
    track(EVENTS.REMINDER_CREATED, meta);
  }

  function trackTaskCreated(meta = {}) {
    track(EVENTS.TASK_CREATED, meta);
  }

  function trackVaultUpload(meta = {}) {
    track(EVENTS.VAULT_UPLOAD, meta);
  }

  function trackAiUsage(meta = {}) {
    track(EVENTS.AI_USAGE, meta);
  }

  function trackUpgradeClick(meta = {}) {
    track(EVENTS.UPGRADE_CLICK, meta);
  }

  window.LifeAdminProductAnalytics = {
    EVENTS,
    track,
    flushQueue,
    trackDailyActive,
    trackSignupOnce,
    trackReminderCreated,
    trackTaskCreated,
    trackVaultUpload,
    trackAiUsage,
    trackUpgradeClick,
  };
})();
