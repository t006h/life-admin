/**
 * Life Admin — Notification Center v1
 * Aggregates reminders, tasks, vault, family, and AI suggestions.
 */
(function () {
  const TABLE = "life_admin_notification_states";
  const LS_KEY = "life_admin_notification_states";

  const CATEGORIES = Object.freeze({
    urgent: { id: "urgent", label: "Urgent", filterLabel: "Urgent" },
    upcoming: { id: "upcoming", label: "Upcoming", filterLabel: "Upcoming" },
    family: { id: "family", label: "Family", filterLabel: "Family" },
    finance: { id: "finance", label: "Finance", filterLabel: "Finance" },
    documents: { id: "documents", label: "Documents", filterLabel: "Documents" },
    ai_suggestions: { id: "ai_suggestions", label: "AI Suggestions", filterLabel: "AI" },
  });

  const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

  const ACTION_CTA = {
    mot: "Book garage",
    passport: "Start renewal",
    licence: "Review licence",
    bills: "Pay or schedule",
    subscriptions: "Review",
    school: "Complete form",
    task: "Open task",
    vault: "Open document",
    family: "View reminder",
    ai: "View suggestion",
  };

  let els = {};
  let handlers = {};
  let allNotifications = [];
  let activeFilter = "all";
  let states = {};
  let useLocalFallback = true;

  function getClient() {
    return window.supabaseClient;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = startOfDay(new Date());
    const due = startOfDay(new Date(dateStr + "T12:00:00"));
    return Math.round((due - today) / 86400000);
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateLabel(dateStr, days) {
    if (days == null) return dateStr ? formatDate(dateStr) : "";
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 7) {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
      });
    }
    return formatDate(dateStr);
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function loadStatesLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      states = raw ? JSON.parse(raw) : {};
    } catch {
      states = {};
    }
  }

  function saveStatesLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify(states));
  }

  async function loadStates() {
    loadStatesLocal();
    const client = getClient();
    if (!client) return states;
    try {
      const { data, error } = await client.from(TABLE).select("*");
      if (error) throw error;
      for (const row of data || []) {
        states[row.notification_key] = {
          readAt: row.read_at || null,
          dismissedAt: row.dismissed_at || null,
          snoozedUntil: row.snoozed_until ? row.snoozed_until.slice(0, 10) : null,
        };
      }
      saveStatesLocal();
      useLocalFallback = false;
    } catch (err) {
      console.warn("Notification states: local only", err.message);
      useLocalFallback = true;
    }
    return states;
  }

  async function persistState(key, patch) {
    const prev = states[key] || {};
    states[key] = { ...prev, ...patch };
    saveStatesLocal();

    if (useLocalFallback || !getClient()) return;
    const row = {
      notification_key: key,
      read_at: states[key].readAt || null,
      dismissed_at: states[key].dismissedAt || null,
      snoozed_until: states[key].snoozedUntil
        ? `${states[key].snoozedUntil}T12:00:00Z`
        : null,
      updated_at: new Date().toISOString(),
    };
    try {
      await getClient().from(TABLE).upsert(row);
    } catch (err) {
      console.warn("Notification state save failed:", err.message);
    }
  }

  function isSnoozed(key) {
    const until = states[key]?.snoozedUntil;
    if (!until) return false;
    const d = daysUntil(until);
    return d != null && d >= 0;
  }

  function isDismissed(key) {
    return Boolean(states[key]?.dismissedAt);
  }

  function isRead(key) {
    return Boolean(states[key]?.readAt);
  }

  function isActive(n) {
    if (isDismissed(n.id)) return false;
    if (isSnoozed(n.id)) return false;
    return true;
  }

  function isUnread(n) {
    return isActive(n) && !isRead(n.id);
  }

  function getUnreadCount() {
    return allNotifications.filter(isUnread).length;
  }

  function getVisibleNotifications() {
    return allNotifications.filter(isActive);
  }

  function makeNotification({
    id,
    category,
    icon,
    title,
    description,
    date,
    dueDate,
    priority,
    actionLabel,
    actionKind,
    actionPayload,
    sort,
  }) {
    return {
      id,
      category,
      icon: icon || "🔔",
      title,
      description: description || "",
      date: date || "",
      dueDate: dueDate || "",
      priority: priority || "normal",
      actionLabel: actionLabel || "View",
      actionKind,
      actionPayload: actionPayload || {},
      sort: sort ?? 500,
    };
  }

  function reminderCategory(item) {
    if (item.urgency === "urgent" || item.days < 0) return CATEGORIES.urgent.id;
    if (item.category === "bills" || item.category === "subscriptions") return CATEGORIES.finance.id;
    if (item.category === "passport" || item.category === "licence") return CATEGORIES.documents.id;
    if (item.category === "mot") return item.days <= 14 ? CATEGORIES.urgent.id : CATEGORIES.upcoming.id;
    return CATEGORIES.upcoming.id;
  }

  function buildFromReminders(ctx) {
    const list = [];
    const { notifications = [], allItems = [] } = ctx;
    const seen = new Set();

    for (const item of notifications) {
      if (!window.LifeAdminAccess?.canAccessCategory?.(item.category)) continue;
      const id = `reminder:${item.category}:${item.id}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const days = item.days;
      let cat = reminderCategory(item);
      const isSub = item.category === "subscriptions";
      const isNetflix = /netflix/i.test(item.title);
      let title = item.config?.notifyLabel || `${item.config?.label} due`;
      let description = item.subtitle ? `${item.subtitle} · ${item.title}` : item.title;
      let actionLabel = ACTION_CTA[item.category] || "View";
      let icon = item.config?.icon || "🔔";

      if (item.category === "mot" && days >= 0 && days <= 30) {
        title = `MOT expires in ${days} days`;
        description = item.subtitle || item.title || "Vehicle MOT";
        icon = "⚠";
        actionLabel = ACTION_CTA.mot;
      } else if (item.category === "passport") {
        title =
          days <= 45 ? `Passport expires in ${days} days` : `Passport renewal in ${days} days`;
        icon = "📄";
        actionLabel = ACTION_CTA.passport;
      } else if (isSub && days >= 0 && days <= 7) {
        title = isNetflix
          ? `${item.title} renews ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}`
          : `${item.title} renews soon`;
        icon = "💳";
        actionLabel = ACTION_CTA.subscriptions;
        cat = CATEGORIES.finance.id;
      } else if (item.category === "bills" && days >= 0 && days <= 14) {
        title = `${item.title} due ${formatDateLabel(item.dueDate, days)}`;
        icon = "💳";
        actionLabel = ACTION_CTA.bills;
      }

      const priority =
        item.urgency === "urgent" || days < 0
          ? "urgent"
          : days <= 3
            ? "high"
            : "normal";

      list.push(
        makeNotification({
          id,
          category: cat,
          icon,
          title,
          description,
          date: formatDateLabel(item.dueDate, days),
          dueDate: item.dueDate,
          priority,
          actionLabel,
          actionKind: "reminder",
          actionPayload: { category: item.category, id: item.id },
          sort: days,
        })
      );
    }

    return list;
  }

  function buildFromFamily(ctx) {
    const list = [];
    const reminders = window.LifeAdminFamily?.getReminders?.() || [];
    for (const r of reminders) {
      const days = daysUntil(r.dueDate);
      if (days == null) continue;
      const id = `family:${r.id}`;
      const isSchool = /school|trip|form/i.test(r.title);
      list.push(
        makeNotification({
          id,
          category: CATEGORIES.family.id,
          icon: isSchool ? "📄" : "⚠",
          title: r.title,
          description: isSchool
            ? `Due ${formatDateLabel(r.dueDate, days)}`
            : `Family reminder · ${formatDateLabel(r.dueDate, days)}`,
          date: formatDateLabel(r.dueDate, days),
          dueDate: r.dueDate,
          priority:
            r.severity === "urgent" || days < 0
              ? "urgent"
              : days <= 3
                ? "high"
                : "normal",
          actionLabel: isSchool ? ACTION_CTA.school : ACTION_CTA.family,
          actionKind: "family_reminder",
          actionPayload: { id: r.id },
          sort: days,
        })
      );
    }
    return list;
  }

  function buildFromTasks(ctx) {
    const list = [];
    const tasks = ctx.tasks || [];
    for (const t of tasks) {
      const days = daysUntil(t.dueDate);
      if (days == null || days > 30) continue;
      const isFamily =
        t.category === "family" ||
        t.assignedTo === "partner" ||
        t.assignedTo === "child" ||
        t.assignedTo === "everyone";
      const id = `task:${t.id}`;
      list.push(
        makeNotification({
          id,
          category: isFamily ? CATEGORIES.family.id : days <= 3 ? CATEGORIES.urgent.id : CATEGORIES.upcoming.id,
          icon: isFamily ? "👨‍👩‍👧" : "✓",
          title: t.title,
          description: t.description || (isFamily ? "Shared family task" : "Task due soon"),
          date: formatDateLabel(t.dueDate, days),
          dueDate: t.dueDate,
          priority:
            t.priority === "high" || days < 0
              ? "urgent"
              : days <= 3
                ? "high"
                : "normal",
          actionLabel: ACTION_CTA.task,
          actionKind: "task",
          actionPayload: { id: t.id },
          sort: days + (isFamily ? 0 : 50),
        })
      );
    }
    return list;
  }

  function buildFromVault(ctx) {
    const list = [];
    const docs = ctx.vaultDocuments || [];
    for (const doc of docs) {
      const days = daysUntil(doc.expiryDate);
      if (days == null || days > 90) continue;
      const id = `vault:${doc.id}`;
      list.push(
        makeNotification({
          id,
          category: CATEGORIES.documents.id,
          icon: "📄",
          title: `${doc.title} expires ${days <= 30 ? `in ${days} days` : formatDate(doc.expiryDate)}`,
          description: `${CATEGORIES[doc.category]?.label || doc.category} document in your vault`,
          date: formatDateLabel(doc.expiryDate, days),
          dueDate: doc.expiryDate,
          priority: days <= 14 ? "urgent" : days <= 45 ? "high" : "normal",
          actionLabel: ACTION_CTA.vault,
          actionKind: "vault",
          actionPayload: { id: doc.id },
          sort: days + 20,
        })
      );
    }
    return list;
  }

  function buildFromAi(ctx) {
    if (!window.LifeAdminAiChief?.canUseAi?.()) return [];
    const hints =
      window.LifeAdminAiChief.generateForgettingHints?.({
        allItems: ctx.allItems || [],
        vaultDocuments: ctx.vaultDocuments || [],
        notifications: ctx.notifications || [],
        tasks: ctx.tasks || [],
      }) || [];

    return hints.map((hint, i) =>
      makeNotification({
        id: `ai:${i}:${hint.text.slice(0, 24)}`,
        category: CATEGORIES.ai_suggestions.id,
        icon: hint.icon || "✨",
        title: hint.text,
        description: hint.sub || "",
        date: "Suggestion",
        dueDate: "",
        priority: "normal",
        actionLabel: "View in AI",
        actionKind: "ai",
        actionPayload: {},
        sort: 800 + i,
      })
    );
  }

  function buildAll(ctx) {
    const merged = [
      ...buildFromReminders(ctx),
      ...buildFromFamily(ctx),
      ...buildFromTasks(ctx),
      ...buildFromVault(ctx),
      ...buildFromAi(ctx),
    ];

    const byId = new Map();
    for (const n of merged) {
      if (!byId.has(n.id)) byId.set(n.id, n);
    }

    return [...byId.values()].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return (a.sort ?? 999) - (b.sort ?? 999);
    });
  }

  function refresh(ctx) {
    allNotifications = buildAll(ctx);
    updateBadge();
    if (els.notificationCenter?.open) renderList();
    return allNotifications;
  }

  function updateBadge() {
    const unread = getUnreadCount();
    if (els.headerNotificationBadge) {
      els.headerNotificationBadge.hidden = unread === 0;
      els.headerNotificationBadge.textContent = unread > 99 ? "99+" : String(unread);
    }
    if (els.headerBellDot) {
      els.headerBellDot.hidden = unread === 0;
    }
    if (els.ncUnreadSummary) {
      els.ncUnreadSummary.textContent =
        unread === 0
          ? "You're all caught up"
          : `${unread} unread notification${unread === 1 ? "" : "s"}`;
    }
  }

  function handleAction(n) {
    close();
    switch (n.actionKind) {
      case "reminder":
        handlers.onOpenReminder?.(n.actionPayload.category, n.actionPayload.id);
        break;
      case "task":
        handlers.onOpenTask?.(n.actionPayload.id);
        break;
      case "vault":
        handlers.onOpenVault?.(n.actionPayload.id);
        break;
      case "family_reminder":
        handlers.onOpenFamilyReminder?.(n.actionPayload.id);
        break;
      case "ai":
        handlers.onOpenAi?.();
        break;
      default:
        break;
    }
  }

  async function markRead(id) {
    await persistState(id, { readAt: new Date().toISOString() });
    updateBadge();
    renderList();
  }

  async function snooze(id) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const until = d.toISOString().slice(0, 10);
    await persistState(id, { snoozedUntil: until, readAt: new Date().toISOString() });
    updateBadge();
    renderList();
  }

  async function dismiss(id) {
    await persistState(id, { dismissedAt: new Date().toISOString() });
    updateBadge();
    renderList();
  }

  function renderFilters() {
    if (!els.notificationFilters) return;
    els.notificationFilters.replaceChildren();

    const filters = [
      { id: "all", label: "All" },
      ...Object.values(CATEGORIES),
    ];

    filters.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `nc-filter${activeFilter === f.id ? " nc-filter--active" : ""}`;
      btn.textContent = f.filterLabel || f.label;
      btn.addEventListener("click", () => {
        activeFilter = f.id;
        renderFilters();
        renderList();
      });
      els.notificationFilters.appendChild(btn);
    });
  }

  function renderNotificationCard(n) {
    const li = document.createElement("li");
    const unread = isUnread(n);
    li.className = `nc-card${unread ? " nc-card--unread" : ""}`;
    li.dataset.category = n.category;

    li.innerHTML = `
      <div class="nc-card__head">
        <span class="nc-card__icon" aria-hidden="true">${escape(n.icon)}</span>
        <div class="nc-card__titles">
          <span class="nc-card__category">${escape(CATEGORIES[n.category]?.label || n.category)}</span>
          <h3 class="nc-card__title">${escape(n.title)}</h3>
        </div>
        <span class="nc-card__priority nc-card__priority--${escape(n.priority)}">${escape(n.priority)}</span>
      </div>
      ${n.description ? `<p class="nc-card__desc">${escape(n.description)}</p>` : ""}
      <p class="nc-card__date">${escape(n.date)}</p>
      <div class="nc-card__actions">
        <button type="button" class="btn btn--primary btn--compact nc-card__cta">${escape(n.actionLabel)}</button>
        <button type="button" class="btn btn--ghost btn--compact" data-nc-read>Read</button>
        <button type="button" class="btn btn--ghost btn--compact" data-nc-snooze>Snooze</button>
        <button type="button" class="btn btn--ghost btn--compact" data-nc-dismiss>Dismiss</button>
      </div>`;

    li.querySelector(".nc-card__cta").addEventListener("click", () => {
      markRead(n.id);
      handleAction(n);
    });
    li.querySelector("[data-nc-read]").addEventListener("click", () => markRead(n.id));
    li.querySelector("[data-nc-snooze]").addEventListener("click", () => snooze(n.id));
    li.querySelector("[data-nc-dismiss]").addEventListener("click", () => dismiss(n.id));

    return li;
  }

  function renderList() {
    if (!els.notificationList) return;
    renderFilters();

    let visible = getVisibleNotifications();
    if (activeFilter !== "all") {
      visible = visible.filter((n) => n.category === activeFilter);
    }

    els.notificationList.replaceChildren();
    if (visible.length === 0) {
      if (els.notificationEmpty) els.notificationEmpty.hidden = false;
      return;
    }
    if (els.notificationEmpty) els.notificationEmpty.hidden = true;
    visible.forEach((n) => els.notificationList.appendChild(renderNotificationCard(n)));
  }

  function open() {
    renderList();
    els.notificationCenter?.showModal();
  }

  function close() {
    els.notificationCenter?.close();
  }

  function init(dom, h = {}) {
    els = { ...dom };
    handlers = h;

    els.btnBell?.addEventListener("click", () => open());
    els.notificationClose?.addEventListener("click", close);
    els.notificationCenter?.addEventListener("click", (e) => {
      if (e.target === els.notificationCenter) close();
    });

    loadStates();
  }

  window.LifeAdminNotificationCenter = {
    CATEGORIES,
    init,
    loadStates,
    refresh,
    buildAll,
    getUnreadCount,
    getVisibleNotifications,
    updateBadge,
    open,
    close,
    markRead,
    snooze,
    dismiss,
  };
})();
