/**
 * Life Admin — Context & Memory Engine v1 (rules-based, no external AI)
 */
(function () {
  const TABLE = "life_admin_context_memories";
  const LS_KEY = "life_admin_context_memories";
  const FEATURE = () => window.LifeAdminAccess?.FEATURES?.CONTEXT_MEMORY || "context.memory";

  const CATEGORIES = Object.freeze({
    people: { label: "People", icon: "👥" },
    preferences: { label: "Preferences", icon: "⚙️" },
    dates: { label: "Important dates", icon: "📅" },
    habits: { label: "Habits & patterns", icon: "🔄" },
  });

  const SEED_MEMORIES = [
    {
      category: "preferences",
      memoryKey: "seed:travel_style",
      title: "Travel style",
      body: "Prefers December holidays and books trips a few months ahead.",
      source: "user",
    },
    {
      category: "habits",
      memoryKey: "seed:insurance_month",
      title: "Insurance renewal",
      body: "Usually renews insurance in July.",
      source: "inferred",
    },
    {
      category: "habits",
      memoryKey: "seed:subscriptions",
      title: "Subscriptions",
      body: "Pays subscriptions around month-end.",
      source: "inferred",
    },
  ];

  let memories = [];
  let useLocalFallback = true;
  let getLiveContext = () => ({});

  function getClient() {
    return window.supabaseClient;
  }

  function canUseContext() {
    return window.LifeAdminAccess?.canAccess?.(FEATURE()) ?? true;
  }

  function rowToMemory(row) {
    return {
      id: row.id,
      category: row.category,
      memoryKey: row.memory_key || "",
      title: row.title,
      body: row.body || "",
      meta: row.meta && typeof row.meta === "object" ? row.meta : {},
      source: row.source || "user",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function memoryToRow(m) {
    return {
      id: m.id,
      category: m.category,
      memory_key: m.memoryKey || "",
      title: m.title,
      body: m.body || "",
      meta: m.meta || {},
      source: m.source || "user",
      updated_at: new Date().toISOString(),
    };
  }

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveLocal(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  function seedIfEmpty() {
    if (memories.length) return;
    const now = new Date().toISOString();
    memories = SEED_MEMORIES.map((s) => ({
      id: crypto.randomUUID(),
      ...s,
      meta: {},
      createdAt: now,
      updatedAt: now,
    }));
    saveLocal(memories);
  }

  async function loadMemories() {
    if (!canUseContext()) {
      memories = [];
      return memories;
    }

    const client = getClient();
    if (!client) {
      useLocalFallback = true;
      memories = loadLocal();
      seedIfEmpty();
      await syncFromFamily();
      inferFromLiveData(getLiveContext());
      return memories;
    }

    try {
      const { data, error } = await client.from(TABLE).select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      useLocalFallback = false;
      memories = (data || []).map(rowToMemory);
      if (!memories.length) {
        for (const s of SEED_MEMORIES) {
          await saveMemory({ ...s, id: crypto.randomUUID() });
        }
      }
      await syncFromFamily();
      inferFromLiveData(getLiveContext());
      return memories;
    } catch (err) {
      console.warn("Context memory: local fallback", err.message);
      useLocalFallback = true;
      memories = loadLocal();
      seedIfEmpty();
      await syncFromFamily();
      return memories;
    }
  }

  async function persistMemory(m) {
    if (useLocalFallback || !getClient()) {
      const idx = memories.findIndex((x) => x.id === m.id);
      if (idx >= 0) memories[idx] = m;
      else memories.unshift(m);
      saveLocal(memories);
      return m;
    }
    const { error } = await getClient().from(TABLE).upsert(memoryToRow(m));
    if (error) throw error;
    const idx = memories.findIndex((x) => x.id === m.id);
    if (idx >= 0) memories[idx] = m;
    else memories.unshift(m);
    return m;
  }

  async function saveMemory(input) {
    const m = {
      id: input.id || crypto.randomUUID(),
      category: input.category || "preferences",
      memoryKey: input.memoryKey || "",
      title: String(input.title || "").trim(),
      body: String(input.body || "").trim(),
      meta: input.meta || {},
      source: input.source || "user",
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!m.title) throw new Error("Title is required");
    if (!m.memoryKey) m.memoryKey = `user:${m.id}`;
    return persistMemory(m);
  }

  async function deleteMemory(id) {
    memories = memories.filter((m) => m.id !== id);
    if (useLocalFallback || !getClient()) {
      saveLocal(memories);
      return;
    }
    await getClient().from(TABLE).delete().eq("id", id);
  }

  function getMemories() {
    return memories;
  }

  function getByCategory() {
    const grouped = {};
    Object.keys(CATEGORIES).forEach((k) => {
      grouped[k] = memories.filter((m) => m.category === k);
    });
    return grouped;
  }

  async function syncFromFamily() {
    const members = window.LifeAdminFamily?.getMembers?.() || [];
    for (const member of members) {
      const key = `family:${member.id}`;
      const roleLabel = window.LifeAdminFamily?.ROLES?.[member.role]?.label || member.role;
      const parts = [member.relationship, roleLabel].filter(Boolean);
      let body = parts.join(" · ");
      if (member.dateOfBirth) {
        body += body ? ` · Birthday ${formatDate(member.dateOfBirth)}` : `Birthday ${formatDate(member.dateOfBirth)}`;
      }
      const existing = memories.find((m) => m.memoryKey === key);
      const record = {
        id: existing?.id || crypto.randomUUID(),
        category: "people",
        memoryKey: key,
        title: member.name,
        body: body || roleLabel,
        meta: { memberId: member.id, role: member.role },
        source: "family_sync",
      };
      if (
        !existing ||
        existing.title !== record.title ||
        existing.body !== record.body
      ) {
        await persistMemory({ ...record, createdAt: existing?.createdAt });
      }
    }
  }

  function formatDate(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }

  function monthName(m) {
    return new Date(2000, m - 1, 1).toLocaleDateString("en-GB", { month: "long" });
  }

  /** Placeholder inference from reminders, tasks, vault */
  async function inferFromLiveData(ctx) {
    if (!ctx?.allItems) return;

    const insurance = ctx.allItems.filter(
      (i) => i.category === "bills" && /insurance/i.test(i.title || "")
    );
    const byMonth = {};
    insurance.forEach((i) => {
      if (!i.dueDate) return;
      const m = parseInt(i.dueDate.slice(5, 7), 10);
      byMonth[m] = (byMonth[m] || 0) + 1;
    });
    const topMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
    if (topMonth && topMonth[1] >= 2) {
      await upsertInferred(
        "inferred:insurance_month",
        "Insurance renewal",
        `Usually renews insurance in ${monthName(parseInt(topMonth[0], 10))}.`,
        "habits"
      );
    }

    const subs = ctx.allItems.filter((i) => i.category === "subscriptions");
    const endOfMonth = subs.filter((i) => {
      if (!i.dueDate) return false;
      const day = parseInt(i.dueDate.slice(8, 10), 10);
      return day >= 25;
    });
    if (endOfMonth.length >= 2) {
      await upsertInferred(
        "inferred:subscriptions_eom",
        "Subscriptions",
        "Pays subscriptions around month-end.",
        "habits"
      );
    }

    const passports = ctx.allItems.filter((i) => i.category === "passport");
    for (const p of passports) {
      if (!p.dueDate) continue;
      await upsertInferred(
        `inferred:passport:${p.id}`,
        "Passport renewal",
        `Passport on file — due ${formatDate(p.dueDate)}.`,
        "dates",
        { reminderId: p.id }
      );
    }
  }

  async function upsertInferred(key, title, body, category, meta = {}) {
    const existing = memories.find((m) => m.memoryKey === key);
    const record = {
      id: existing?.id || crypto.randomUUID(),
      category,
      memoryKey: key,
      title,
      body,
      meta,
      source: "inferred",
      createdAt: existing?.createdAt,
    };
    if (!existing || existing.body !== body) {
      await persistMemory(record);
    }
  }

  function buildSnapshot(ctx) {
    const live = ctx || getLiveContext();
    return {
      memories: getMemories(),
      grouped: getByCategory(),
      people: window.LifeAdminFamily?.getMembers?.() || [],
      vaultDocuments: live.vaultDocuments || [],
      workflows: live.workflows || [],
      allItems: live.allItems || [],
      tasks: live.tasks || [],
    };
  }

  function getContextForRequest(text, ctx) {
    const snap = buildSnapshot(ctx);
    const lower = String(text || "").toLowerCase();
    const notes = [];
    const extraForgetting = [];

    const people = snap.grouped.people || [];
    const prefs = snap.grouped.preferences || [];
    const habits = snap.grouped.habits || [];
    const dates = snap.grouped.dates || [];

    const isHoliday =
      /\b(holiday|vacation|going away|flight|trip)\b/i.test(text) ||
      lower.includes("plan our holiday");

    if (isHoliday) {
      if (people.length) {
        const names = people.map((p) => p.title).join(", ");
        notes.push({ icon: "👥", text: `Travelling with household: ${names}` });
      }

      const passportItems = (snap.allItems || []).filter((i) => i.category === "passport");
      passportItems.forEach((p) => {
        const days = daysUntil(p.dueDate);
        if (days != null) {
          notes.push({
            icon: "🛂",
            text:
              days <= 180
                ? `Passport reminder: ${p.title} (${days} days)`
                : `Passport on file: ${p.title}`,
          });
        }
      });

      const passportDocs = (snap.vaultDocuments || []).filter((d) =>
        /passport/i.test(d.title || d.name || d.category || "")
      );
      if (passportDocs.length) {
        notes.push({
          icon: "🛡️",
          text: `${passportDocs.length} passport document(s) in Vault`,
        });
      }

      const activeHoliday = (snap.workflows || []).find(
        (w) => w.workflowType === "holiday_planning" && w.status === "active"
      );
      if (activeHoliday) {
        notes.push({
          icon: "✈️",
          text: `Active holiday workflow (${activeHoliday.title})`,
        });
      }

      prefs
        .filter((p) => /travel|holiday|flight/i.test(p.title + p.body))
        .forEach((p) => {
          notes.push({ icon: "⚙️", text: p.body || p.title });
        });

      habits
        .filter((h) => /travel|december|holiday/i.test(h.title + h.body))
        .forEach((h) => {
          notes.push({ icon: "🔄", text: h.body });
          if (/december/i.test(h.body)) {
            extraForgetting.push({
              text: "Book December travel early",
              sub: "Based on your usual travel month",
            });
          }
        });

      if (!passportItems.length) {
        extraForgetting.push({
          text: "Check passport validity (6+ months)",
          sub: "No passport reminder on file yet",
        });
      }
    }

    if (/\b(insurance|renew insurance)\b/i.test(text)) {
      habits
        .filter((h) => /insurance/i.test(h.title + h.body))
        .forEach((h) => notes.push({ icon: "🔄", text: h.body }));
    }

    if (/\b(school|trip|theo)\b/i.test(text)) {
      const children = people.filter((p) => /child|school/i.test(p.body + p.title));
      children.forEach((p) => notes.push({ icon: "📄", text: `School context: ${p.title}` }));
    }

    return {
      notes,
      extraForgetting,
      snapshot: snap,
    };
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + "T12:00:00");
    due.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function personalizePlan(plan, ctx, text) {
    if (!plan) return plan;
    const { notes, extraForgetting } = getContextForRequest(text || plan.detection?.text || "", ctx);

    const forgetting = [...(plan.forgetting || [])];
    extraForgetting.forEach((h) => {
      if (!forgetting.some((f) => f.text === h.text)) forgetting.push(h);
    });

    let summary = plan.summary;
    if (notes.length && plan.blueprintId !== "generic") {
      summary = `${plan.summary} — personalized with ${notes.length} context clue${notes.length === 1 ? "" : "s"}`;
    }

    return {
      ...plan,
      summary,
      contextNotes: notes,
      forgetting: forgetting.slice(0, 8),
    };
  }

  function init(opts = {}) {
    getLiveContext = opts.getLiveContext || getLiveContext;
  }

  window.LifeAdminContextEngine = {
    CATEGORIES,
    init,
    loadMemories,
    getMemories,
    getByCategory,
    saveMemory,
    deleteMemory,
    syncFromFamily,
    inferFromLiveData,
    getContextForRequest,
    personalizePlan,
    buildSnapshot,
    canUseContext,
  };
})();
