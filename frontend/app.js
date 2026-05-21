/**
 * Life Admin — personal chief-of-staff for life administration
 * Data persisted in Supabase (life_admin_items table)
 */

const TABLE = "life_admin_items";
const Access = () => window.LifeAdminAccess;
const FEATURES = () => Access().FEATURES;

const CATEGORIES = {
  mot: {
    label: "MOT",
    icon: "🚗",
    titleLabel: "Vehicle",
    subtitleLabel: "Registration (optional)",
    showAmount: false,
    showFrequency: false,
    notifyDays: 30,
    urgentDays: 7,
    notifyLabel: "MOT due within 30 days",
  },
  passport: {
    label: "Passport",
    icon: "🛂",
    titleLabel: "Holder name",
    subtitleLabel: "Passport number (optional)",
    showAmount: false,
    showFrequency: false,
    notifyDays: 90,
    urgentDays: 14,
    notifyLabel: "Passport due within 90 days",
  },
  licence: {
    label: "Driving licence",
    icon: "🪪",
    titleLabel: "Holder name",
    subtitleLabel: "Licence number (optional)",
    showAmount: false,
    showFrequency: false,
    notifyDays: 90,
    urgentDays: 14,
    notifyLabel: "Licence due within 90 days",
  },
  subscriptions: {
    label: "Subscription",
    icon: "↻",
    titleLabel: "Service name",
    subtitleLabel: "Provider (optional)",
    showAmount: true,
    showFrequency: true,
    notifyTodayOnly: true,
    notifyLabel: "Subscription due today",
  },
  bills: {
    label: "Bill",
    icon: "£",
    titleLabel: "Bill name",
    subtitleLabel: "Payee (optional)",
    showAmount: true,
    showFrequency: true,
    notifyDays: 30,
    urgentDays: 7,
    notifyLabel: "Bill due within 30 days",
  },
};

// --- State ---

let state = emptyState();
let currentView = "dashboard";
let editingItem = null;
let isLoading = false;
let isSaving = false;

function getClient() {
  return window.supabaseClient;
}

function emptyState() {
  return {
    mot: [],
    passport: [],
    licence: [],
    subscriptions: [],
    bills: [],
  };
}

// --- Supabase mapping ---

function rowToItem(row) {
  return {
    id: row.id,
    title: row.title || "",
    subtitle: row.subtitle || "",
    dueDate: row.due_date,
    amount: row.amount != null ? Number(row.amount) : null,
    frequency: row.frequency || "monthly",
    notes: row.notes || "",
    vaultDocumentId: row.vault_document_id || null,
  };
}

function itemToRow(item, category) {
  const row = {
    id: item.id,
    category,
    title: item.title,
    subtitle: item.subtitle || "",
    due_date: item.dueDate,
    amount: item.amount,
    frequency: item.frequency || "monthly",
    notes: item.notes || "",
    updated_at: new Date().toISOString(),
  };
  if (item.vaultDocumentId) row.vault_document_id = item.vaultDocumentId;
  return row;
}

function rowsToState(rows) {
  const next = emptyState();
  for (const row of rows) {
    if (next[row.category]) {
      next[row.category].push(rowToItem(row));
    }
  }
  return next;
}

async function loadFromSupabase() {
  const client = getClient();
  if (!client) {
    throw new Error(window.supabaseConfigError || "Supabase is not configured");
  }

  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .order("due_date", { ascending: true });

  if (error) throw error;
  return rowsToState(data || []);
}

async function upsertItem(category, item) {
  const client = getClient();
  let row = itemToRow(item, category);
  let { error } = await client.from(TABLE).upsert(row);
  if (error && /vault_document_id/.test(error.message || "")) {
    delete row.vault_document_id;
    ({ error } = await client.from(TABLE).upsert(row));
  }
  if (error) throw error;
}

async function deleteItemFromDb(id) {
  const client = getClient();
  const { error } = await client.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

// --- Dates & notifications ---

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntil(dueDateStr) {
  if (!dueDateStr) return Infinity;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDateStr + "T12:00:00"));
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function shouldNotify(category, days) {
  const rules = CATEGORIES[category];
  if (!rules) return false;
  if (rules.notifyTodayOnly) return days <= 0;
  return days <= rules.notifyDays;
}

function urgencyLevel(category, days) {
  if (days < 0) return "urgent";
  const rules = CATEGORIES[category];
  if (!rules) return "ok";
  if (rules.notifyTodayOnly) return days === 0 ? "urgent" : "ok";
  if (!shouldNotify(category, days)) return "ok";
  if (days <= rules.urgentDays) return "urgent";
  return "warning";
}

function urgencyLabel(days, category, dueDate) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  const rules = CATEGORIES[category];
  if (rules && rules.notifyTodayOnly) return "Due today";
  if (rules && days <= rules.urgentDays) return `${days}d left`;
  if (rules && shouldNotify(category, days)) return `In ${days} days`;
  return dueDate ? formatDate(dueDate) : `In ${days} days`;
}

function enrichItem(item, category) {
  const days = daysUntil(item.dueDate);
  const notify = shouldNotify(category, days);
  const urgency = urgencyLevel(category, days);
  return {
    ...item,
    category,
    days,
    notify,
    urgency,
    config: CATEGORIES[category],
  };
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(amount) {
  if (amount == null || amount === "") return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function frequencyLabel(freq) {
  const map = {
    monthly: "Monthly",
    yearly: "Yearly",
    weekly: "Weekly",
    quarterly: "Quarterly",
    once: "One-off",
  };
  return map[freq] || freq;
}

// --- Aggregated items & notifications ---

function getAllItems() {
  const items = [];
  for (const [category, list] of Object.entries(state)) {
    for (const item of list) {
      items.push(enrichItem(item, category));
    }
  }
  return items;
}

function getNotifications() {
  return getAllItems()
    .filter((item) => item.notify && Access().canAccessCategory(item.category))
    .sort((a, b) => {
      if (a.urgency === "urgent" && b.urgency !== "urgent") return -1;
      if (b.urgency === "urgent" && a.urgency !== "urgent") return 1;
      return a.days - b.days;
    });
}

function getTodayItems() {
  return getNotifications();
}

function getCategoryItems(category) {
  return state[category]
    .map((item) => enrichItem(item, category))
    .sort((a, b) => a.days - b.days);
}

// --- DOM refs ---

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const briefingEls = {
  headerGreeting: $("#headerGreeting"),
  statImportant: $("#statImportant"),
  statUpcoming: $("#statUpcoming"),
  statOverdue: $("#statOverdue"),
  statCompleted: $("#statCompleted"),
  briefingPriorities: $("#briefingPriorities"),
  briefingInsights: $("#briefingInsights"),
  headerNotificationBadge: $("#headerNotificationBadge"),
  headerBellDot: $("#headerBellDot"),
};

const uiEls = {
  fabAdd: $("#fabAdd"),
  fabMenu: $("#fabMenu"),
  filterTasks: $("#filterTasks"),
  filterUpcoming: $("#filterUpcoming"),
  panelTasks: $("#panelTasks"),
  panelUpcoming: $("#panelUpcoming"),
  btnMenu: $("#btnMenu"),
  sideMenu: $("#sideMenu"),
  sideMenuClose: $("#sideMenuClose"),
  sideMenuNav: $("#sideMenuNav"),
};

const brainDumpEls = {
  brainDumpModal: $("#brainDumpModal"),
  brainDumpClose: $("#brainDumpClose"),
  brainDumpText: $("#brainDumpText"),
  brainDumpConvert: $("#brainDumpConvert"),
  brainDumpResult: $("#brainDumpResult"),
};

const todayEls = {
  upcomingList: $("#upcomingList"),
  linkedDocsList: $("#linkedDocsList"),
  linkedDocsEmpty: $("#linkedDocsEmpty"),
  linkedDocsCard: $("#linkedDocsCard"),
  dailyTimelineCard: $("#dailyTimelineCard"),
  dailyTimelineList: $("#dailyTimelineList"),
};

const els = {
  appBanner: $("#appBanner"),
  appBannerText: $("#appBannerText"),
  accountChip: $("#accountChip"),
  accountPlan: $("#accountPlan"),
  accountRole: $("#accountRole"),
  founderFlags: $("#founderFlags"),
  adminPanel: $("#adminPanel"),
  itemModal: $("#itemModal"),
  itemForm: $("#itemForm"),
  modalTitle: $("#modalTitle"),
  modalClose: $("#modalClose"),
  btnDelete: $("#btnDelete"),
  btnSave: $("#itemForm button[type='submit']"),
  itemId: $("#itemId"),
  itemCategory: $("#itemCategory"),
  labelTitle: $("#labelTitle"),
  labelSubtitle: $("#labelSubtitle"),
  fieldTitle: $("#fieldTitle"),
  fieldSubtitle: $("#fieldSubtitle"),
  fieldSubtitleWrap: $("#fieldSubtitleWrap"),
  labelDueDate: $("#labelDueDate"),
  fieldDueDate: $("#fieldDueDate"),
  amountRow: $("#amountRow"),
  fieldAmount: $("#fieldAmount"),
  fieldFrequency: $("#fieldFrequency"),
  fieldNotes: $("#fieldNotes"),
};

const listEls = {
  mot: { list: $("#motList"), empty: $("#motEmpty") },
  passport: { list: $("#passportList"), empty: $("#passportEmpty") },
  licence: { list: $("#licenceList"), empty: $("#licenceEmpty") },
  subscriptions: { list: $("#subscriptionsList"), empty: $("#subscriptionsEmpty") },
  bills: { list: $("#billsList"), empty: $("#billsEmpty") },
};

// --- Banner ---

function showBanner(type, message) {
  els.appBanner.hidden = false;
  els.appBanner.className = `app-banner app-banner--${type}`;
  els.appBannerText.textContent = message;
}

function showAppError(message) {
  showBanner("error", message);
  setTimeout(hideBanner, 5000);
}

function hideBanner() {
  els.appBanner.hidden = true;
}

function setInteractable(enabled) {
  if (uiEls.fabAdd) uiEls.fabAdd.disabled = !enabled;
  const intentInput = document.getElementById("intentInput");
  if (intentInput) intentInput.disabled = !enabled;
  $$(".tab-bar__item, .filter-pill").forEach((btn) => {
    btn.disabled = !enabled;
  });
}

function setFabOpen(open) {
  if (!uiEls.fabMenu || !uiEls.fabAdd) return;
  uiEls.fabMenu.classList.toggle("is-open", open);
  uiEls.fabMenu.hidden = !open;
  uiEls.fabMenu.setAttribute("aria-hidden", open ? "false" : "true");
  uiEls.fabAdd.classList.toggle("is-open", open);
  uiEls.fabAdd.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleFilterPanel(which) {
  const showTasks = which === "tasks";
  const showUpcoming = which === "upcoming";
  const tasksActive = showTasks && !uiEls.panelTasks?.hidden;
  const upcomingActive = showUpcoming && !uiEls.panelUpcoming?.hidden;

  if (showTasks) {
    uiEls.panelTasks.hidden = tasksActive;
    if (!tasksActive) uiEls.panelUpcoming.hidden = true;
  } else if (showUpcoming) {
    uiEls.panelUpcoming.hidden = upcomingActive;
    if (!upcomingActive) uiEls.panelTasks.hidden = true;
  }

  uiEls.filterTasks?.classList.toggle(
    "filter-pill--active",
    showTasks && !uiEls.panelTasks?.hidden
  );
  uiEls.filterUpcoming?.classList.toggle(
    "filter-pill--active",
    showUpcoming && !uiEls.panelUpcoming?.hidden
  );

  if (!uiEls.panelTasks?.hidden) window.LifeAdminTasks.renderTaskCards();
}

function getPrimaryTab(view) {
  if (view === "vault" || CATEGORIES[view]) return "vault";
  if (view === "ai") return "ai";
  return "dashboard";
}

function renderSideMenu() {
  if (!uiEls.sideMenuNav) return;
  uiEls.sideMenuNav.replaceChildren();

  const hint = document.createElement("p");
  hint.className = "side-menu__hint";
  hint.textContent = "Type on Today for almost everything. Power tools:";
  uiEls.sideMenuNav.appendChild(hint);

  const links = [
    { nav: "tasks", label: "All tasks" },
    { nav: "planning", label: "Planning & calendar" },
    { nav: "family", label: "Family" },
    { nav: "life-events", label: "Life event workflows" },
    ...Object.keys(CATEGORIES).map((k) => ({
      nav: k,
      label: CATEGORIES[k].label,
    })),
  ];
  for (const link of links) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "side-menu__link";
    btn.textContent = link.label;
    btn.addEventListener("click", () => {
      uiEls.sideMenu?.close();
      switchView(link.nav);
      document.querySelector(".app")?.classList.add("app--expanded");
    });
    uiEls.sideMenuNav.appendChild(btn);
  }

  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = "side-menu__link side-menu__link--muted";
  replay.textContent = "Replay onboarding";
  replay.addEventListener("click", () => {
    uiEls.sideMenu?.close();
    window.LifeAdminApp?.resetOnboarding?.();
  });
  uiEls.sideMenuNav.appendChild(replay);
}

// --- Access control UI ---

function getFirstAccessibleCategory() {
  for (const cat of Object.keys(CATEGORIES)) {
    if (Access().canAccessCategory(cat)) return cat;
  }
  return null;
}

function showUpgradeAlert(categoryOrFeature) {
  const feature =
    typeof categoryOrFeature === "string" && categoryOrFeature.startsWith("category.")
      ? categoryOrFeature
      : Access().CATEGORY_FEATURE[categoryOrFeature];
  alert(Access().getUpgradeMessage(feature || Access().FEATURES.CATEGORY_SUBSCRIPTIONS));
}

function renderAccountChip() {
  const { role, plan, fullName } = Access().getUserContext();
  const planLabel = Access().PLAN_LABELS[plan] || plan;
  els.accountPlan.textContent = fullName ? `${fullName} · ${planLabel}` : planLabel;
  els.accountChip.classList.toggle("account-chip--founder", Access().bypassesRestrictions());
  els.accountChip.title = `${Access().ROLE_LABELS[role] || role} on ${planLabel} plan`;

  const showRole = role === Access().ROLES.FOUNDER || role === Access().ROLES.ADMIN;
  els.accountRole.hidden = !showRole;
  if (showRole) {
    els.accountRole.textContent = Access().ROLE_LABELS[role] || role;
  }
}

function renderFounderFlags() {
  const showBeta = Access().canAccessBeta();
  const showExperimental = Access().canAccessExperimental();
  els.founderFlags.hidden = !showBeta && !showExperimental;
  if (els.founderFlags.hidden) return;

  const badges = els.founderFlags.querySelectorAll(".founder-flags__badge");
  if (badges[0]) badges[0].hidden = !showBeta;
  if (badges[1]) badges[1].hidden = !showExperimental;
}

async function applyAccessUI() {
  renderAccountChip();
  renderFounderFlags();
  await window.LifeAdminAdmin.initAdminPanel(els.adminPanel);

  $$(".tab-bar__item").forEach((btn) => {
    const nav = btn.dataset.nav;
    if (nav === "ai") {
      const locked = !window.LifeAdminAiChief?.canUseAi?.();
      btn.classList.toggle("tab-bar__item--locked", locked);
      btn.setAttribute("aria-disabled", locked ? "true" : "false");
      return;
    }
    btn.classList.remove("tab-bar__item--locked");
    btn.removeAttribute("aria-disabled");
  });

  Object.keys(listEls).forEach((category) => {
    const view = document.querySelector(`[data-view="${category}"]`);
    if (view) {
      view.classList.toggle("view--locked", !Access().canAccessCategory(category));
    }
  });
}

// --- Render ---

function renderCard(item) {
  const { config, urgency, days, title, subtitle, dueDate, amount, frequency, category, notify } = item;
  const badgeClass =
    urgency === "urgent" ? "card__badge--urgent" : urgency === "warning" ? "card__badge--warning" : "card__badge--due";
  const cardClass = urgency === "urgent" ? "card--urgent" : urgency === "warning" ? "card--warning" : "";

  let meta = urgencyLabel(days, category, dueDate);
  if (subtitle) meta = `${subtitle} · ${meta}`;
  if (amount != null && amount !== "") {
    meta = `${formatMoney(amount)}${frequency ? ` · ${frequencyLabel(frequency)}` : ""} · ${meta}`;
  }

  const badgeText =
    urgency === "urgent" ? "Urgent" : urgency === "warning" ? "Soon" : notify ? "Due" : formatDate(dueDate);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `card ${cardClass}`.trim();
  btn.dataset.id = item.id;
  btn.dataset.category = category;
  btn.innerHTML = `
    <span class="card__icon" aria-hidden="true">${config.icon}</span>
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(title)}</h3>
      <p class="card__meta">${escapeHtml(meta)}</p>
    </div>
    <span class="card__badge ${badgeClass}">${escapeHtml(badgeText)}</span>
  `;
  btn.addEventListener("click", () => openEditModal(category, item.id));
  return btn;
}

function handleQuickAction(action) {
  switch (action) {
    case "reminder": {
      const cat = getFirstAccessibleCategory() || "mot";
      openAddModal(cat);
      break;
    }
    case "task":
      window.LifeAdminTasks.openAddModal();
      break;
    case "braindump":
      window.LifeAdminBriefing.openBrainDump?.();
      break;
    case "document":
      alert("Add document — coming soon. Store passports, forms & receipts.");
      break;
    case "family":
      switchView("family");
      window.LifeAdminFamily?.openMemberModal?.();
      break;
    default:
      break;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderList(container, items, emptyEl) {
  container.replaceChildren();
  if (items.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  for (const item of items) {
    container.appendChild(renderCard(item));
  }
}

function getNotificationContext() {
  const all = getAllItems();
  const notifications = getNotifications();
  const tasks = window.LifeAdminTasks.getTasks();
  const vaultDocuments = window.LifeAdminVault?.getDocuments?.() || [];
  const workflows = window.LifeAdminLifeEvents?.getEvents?.() || [];
  return { allItems: all, notifications, tasks, vaultDocuments, workflows };
}

function getFullContextPayload() {
  return {
    ...getNotificationContext(),
    familyMembers: window.LifeAdminFamily?.getMembers?.() || [],
    memories: window.LifeAdminContextEngine?.getMemories?.() || [],
  };
}

function refreshNotificationCenter() {
  return window.LifeAdminNotificationCenter?.refresh?.(getNotificationContext());
}

function renderDashboard() {
  const all = getAllItems();
  const notifications = getNotifications();
  const tasks = window.LifeAdminTasks.getTasks();
  const vaultDocuments = window.LifeAdminVault?.getDocuments?.() || [];

  refreshNotificationCenter();
  const notificationCount =
    window.LifeAdminNotificationCenter?.getUnreadCount?.() ?? notifications.length;

  const overview = window.LifeAdminBriefing.computeOverview({
    notifications,
    allItems: all,
    tasks,
  });
  const priorities = window.LifeAdminBriefing.buildBriefingPriorities(notifications, tasks);
  const vaultDocs = window.LifeAdminVault?.getDocuments?.() || [];
  const insights = window.LifeAdminBriefing.generateInsights({
    notifications,
    allItems: all,
    tasks,
    vaultDocuments: vaultDocs,
  });

  window.LifeAdminBriefing.renderBriefing(
    briefingEls,
    {
      overview,
      priorities,
      insights,
      notificationCount,
    },
    {
      onOpenReminder: openEditModal,
      onOpenTask: (id) => window.LifeAdminTasks.openEditModal(id),
      onQuickAction: handleQuickAction,
    }
  );

  window.LifeAdminToday.renderUpcoming({
    els: todayEls,
    allItems: all,
    onOpenItem: openEditModal,
  });

  window.LifeAdminToday.renderLinkedDocuments({
    els: todayEls,
    documents: vaultDocs,
    onOpenVault: (docId) => {
      switchView("vault");
      const doc = vaultDocs.find((d) => d.id === docId);
      if (doc && window.LifeAdminVault) {
        setTimeout(() => {
          document.querySelector(`[data-vault-doc="${docId}"]`)?.scrollIntoView?.({ behavior: "smooth" });
        }, 100);
      }
    },
  });

  const timelineEntries = window.LifeAdminPlanning?.buildDailyTimeline?.(getNotificationContext()) || [];
  window.LifeAdminToday.renderDailyTimeline({
    els: todayEls,
    entries: timelineEntries,
    onOpenBlock: (blockId) => {
      switchView("planning");
      const block = window.LifeAdminPlanning?.getTimeBlocks?.()?.find((b) => b.id === blockId);
      if (block) setTimeout(() => openPlanningBlock(block), 200);
    },
  });

  window.LifeAdminWorkflowUI?.renderWorkflowCards?.();

  window.LifeAdminActionUI?.render?.(getFullContextPayload());

  window.LifeAdminTodayOS?.render?.({
    notifications,
    tasks,
    allItems: all,
  });

  window.LifeAdminOSBindings?.refreshLists?.();
}

function openPlanningBlock(block) {
  switchView("planning");
  window.LifeAdminPlanning?.openBlockModal?.(block);
}

async function upsertReminderFromVault({ docId, reminderCategory, item }) {
  if (!Access().canAccessCategory(reminderCategory)) {
    console.warn("Vault reminder skipped: plan does not include", reminderCategory);
    return null;
  }

  const list = state[reminderCategory] || [];
  const existingId = item.id;
  const id = existingId || crypto.randomUUID();
  const record = {
    id,
    title: item.title,
    subtitle: item.subtitle || "",
    dueDate: item.dueDate,
    amount: item.amount,
    frequency: item.frequency || "monthly",
    notes: item.notes || "",
    vaultDocumentId: docId,
  };

  if (!existingId && !Access().canAddItem(reminderCategory, list.length)) {
    console.warn("Vault reminder skipped: item limit on", reminderCategory);
    return null;
  }

  await upsertItem(reminderCategory, record);
  const idx = list.findIndex((i) => i.id === id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  return id;
}

async function reloadRemindersFromDb() {
  if (!getClient()) return;
  try {
    state = await loadFromSupabase();
    await renderAll();
  } catch (err) {
    console.warn("Reload reminders failed:", err.message);
  }
}

window.LifeAdminReminders = {
  upsertFromVault: upsertReminderFromVault,
  reloadReminders: reloadRemindersFromDb,
};

function renderCategory(category) {
  const { list, empty } = listEls[category];
  if (!Access().canAccessCategory(category)) {
    list.replaceChildren();
    empty.hidden = false;
    empty.textContent = Access().getUpgradeMessage(Access().CATEGORY_FEATURE[category]);
    return;
  }
  empty.textContent = `No ${CATEGORIES[category].label.toLowerCase()} reminders yet.`;
  renderList(list, getCategoryItems(category), empty);
}

function renderAiChief() {
  if (!window.LifeAdminAiChief?.render) return;

  const all = getAllItems();
  const notifications = getNotifications();
  const tasks = window.LifeAdminTasks?.getTasks?.() || [];
  const vaultDocs = window.LifeAdminVault?.getDocuments?.() || [];
  const overview = window.LifeAdminBriefing?.computeOverview?.({
    notifications,
    allItems: all,
    tasks,
  }) || { importantTasks: 0, upcomingReminders: 0, overdue: 0, completedToday: 0 };

  window.LifeAdminContextUI?.render?.();
  window.LifeAdminAiPrompts?.render?.();

  window.LifeAdminAnalytics.render(
    {
      analyticsCard: document.getElementById("analyticsCard"),
      lifeBalanceScore: document.getElementById("lifeBalanceScore"),
      completionRate: document.getElementById("completionRate"),
      stressIndicator: document.getElementById("stressIndicator"),
      monthlyTrend: document.getElementById("monthlyTrend"),
      analyticsTrendBars: document.getElementById("analyticsTrendBars"),
    },
    getFullContextPayload()
  );

  try {
    window.LifeAdminAiChief.render(
    {
      allItems: all,
      notifications,
      tasks,
      vaultDocuments: vaultDocs,
      overview,
    },
    {
      onOpenReminder: openEditModal,
      onOpenTask: (id) => window.LifeAdminTasks.openEditModal(id),
      onOpenVault: (docId) => {
        switchView("vault");
        setTimeout(() => {
          document.querySelector(`[data-vault-doc="${docId}"]`)?.scrollIntoView?.({
            behavior: "smooth",
          });
        }, 150);
      },
    }
    );
  } catch (err) {
    console.error("AI Chief render failed:", err);
  }
}

function renderPlanning() {
  window.LifeAdminPlanning?.renderPlanning?.(getNotificationContext());
}

function renderLifeEvents() {
  window.LifeAdminLifeEvents?.renderLifeEvents?.();
}

function navigateFromIntent(view) {
  switchView(view);
}

async function intentAddCalendarBlock(action) {
  switchView("planning");
  await window.LifeAdminPlanning?.loadTimeBlocks?.();
  window.LifeAdminPlanning?.openBlockModal?.({
    title: action.title || "Appointment",
    blockDate: action.dueDate || action.blockDate || new Date().toISOString().slice(0, 10),
    startTime: action.startTime || "09:00:00",
    endTime: action.endTime || "10:00:00",
    category: action.category || "family",
    priority: "medium",
  });
}

const workflowIntentHandlers = {
  onNavigate: navigateFromIntent,
  onAddReminder: async (category, item) => {
    await createReminderFromWorkflow(category, item);
    showBanner("loading", "Reminder added.");
    setTimeout(hideBanner, 1500);
  },
  onAddTask: async (item) => {
    if (!getClient()) {
      window.LifeAdminTasks.openAddModal();
      return;
    }
    await window.LifeAdminTasks.createTaskQuick(item);
  },
  onAddFamilyReminder: async (item) => {
    await window.LifeAdminFamily?.createReminderQuick?.(item);
  },
  onAddCalendarBlock: intentAddCalendarBlock,
  onBrainDump: () => window.LifeAdminBriefing.openBrainDump?.(),
  onIntentComplete: () => renderAll(),
  onWorkflowActivated: async () => {
    await window.LifeAdminLifeEvents?.loadEvents?.();
    window.LifeAdminWorkflowUI?.renderWorkflowCards?.();
  },
};

workflowIntentHandlers.onActivateWorkflow = async (plan, opts = {}) => {
  const ev = await window.LifeAdminWorkflowEngine.activatePlan(
    plan,
    workflowIntentHandlers
  );
  await window.LifeAdminLifeEvents?.loadEvents?.();
  window.LifeAdminWorkflowUI?.renderWorkflowCards?.();
  const section = document.getElementById("workflowCardsSection");
  if (section) section.hidden = false;
  if (!opts?.silent) {
    showBanner("loading", `${plan.title} is set up — tasks, reminders & timeline ready.`);
    setTimeout(hideBanner, 2200);
  }
  return ev;
};

async function createReminderFromWorkflow(category, item) {
  if (!Access().canAccessCategory(category)) return;
  const list = state[category] || [];
  const id = item.id || crypto.randomUUID();
  const record = {
    id,
    title: item.title,
    subtitle: item.subtitle || "",
    dueDate: item.dueDate,
    amount: null,
    frequency: "once",
    notes: item.notes || "",
  };
  await upsertItem(category, record);
  const idx = list.findIndex((i) => i.id === id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
}

async function renderAll() {
  await applyAccessUI();
  await Promise.all([
    window.LifeAdminVault?.loadDocuments?.(),
    window.LifeAdminFamily?.loadAll?.().catch((e) => {
      console.warn("Family load failed:", e);
      return null;
    }),
    window.LifeAdminNotificationCenter?.loadStates?.().catch(() => null),
    window.LifeAdminPlanning?.loadTimeBlocks?.().catch(() => null),
    window.LifeAdminLifeEvents?.loadEvents?.().catch(() => null),
    window.LifeAdminContextEngine?.loadMemories?.().catch(() => null),
  ]);
  renderDashboard();
  renderAiChief();
  window.LifeAdminVault?.renderVault?.();
  window.LifeAdminFamily?.renderFamily?.();
  renderPlanning();
  renderLifeEvents();
  for (const cat of Object.keys(CATEGORIES)) {
    renderCategory(cat);
  }
}

// --- Navigation ---

function syncTabBarForView(view) {
  const tabActive = getPrimaryTab(view);
  $$(".tab-bar__item").forEach((btn) => {
    const active = btn.dataset.nav === tabActive;
    btn.classList.toggle("tab-bar__item--active", active);
    btn.setAttribute("aria-current", active ? "page" : null);
  });
}

function switchView(view) {
  if (view === "life-events") {
    currentView = view;
    $$(".view").forEach((el) => {
      el.classList.toggle("view--active", el.dataset.view === view);
    });
    syncTabBarForView(view);
    renderLifeEvents();
    hideFabDocks();
    return;
  }
  if (view === "planning" && !window.LifeAdminPlanning?.canUsePlanning?.()) {
    currentView = view;
    $$(".view").forEach((el) => {
      el.classList.toggle("view--active", el.dataset.view === view);
    });
    syncTabBarForView(view);
    renderPlanning();
    hideFabDocks();
    return;
  }
  if (view === "family" && !window.LifeAdminFamily?.canUseFamily?.()) {
    currentView = view;
    $$(".view").forEach((el) => {
      el.classList.toggle("view--active", el.dataset.view === view);
    });
    syncTabBarForView(view);
    window.LifeAdminFamily?.renderFamily?.();
    hideFabDocks();
    return;
  }
  if (view === "ai" && !window.LifeAdminAiChief?.canUseAi?.()) {
    currentView = view;
    $$(".view").forEach((el) => {
      el.classList.toggle("view--active", el.dataset.view === view);
    });
    syncTabBarForView(view);
    renderAiChief();
    hideFabDocks();
    return;
  }
  if (CATEGORIES[view] && !Access().canAccessCategory(view)) {
    showUpgradeAlert(view);
    return;
  }
  currentView = view;
  $$(".view").forEach((el) => {
    el.classList.toggle("view--active", el.dataset.view === view);
  });

  const tabActive = getPrimaryTab(view);

  $$(".tab-bar__item").forEach((btn) => {
    const active = btn.dataset.nav === tabActive;
    btn.classList.toggle("tab-bar__item--active", active);
    btn.setAttribute("aria-current", active ? "page" : null);
  });

  if (view === "tasks") window.LifeAdminTasks.renderTaskCards();
  if (view === "vault") window.LifeAdminVault?.renderVault?.();
  if (view === "family") window.LifeAdminFamily?.renderFamily?.();
  if (view === "planning") renderPlanning();
  if (view === "life-events") renderLifeEvents();
  if (view === "ai") renderAiChief();

  const fabDock = document.getElementById("fabDock");
  const vaultFabDock = document.getElementById("vaultFabDock");
  const familyFabDock = document.getElementById("familyFabDock");
  if (fabDock) fabDock.hidden = true;
  if (vaultFabDock) vaultFabDock.hidden = view !== "vault";
  if (familyFabDock) familyFabDock.hidden = view !== "family" || !window.LifeAdminFamily?.canUseFamily?.();

  setFabOpen(false);
  window.LifeAdminVault?.setVaultFabOpen?.(false);
}

function hideFabDocks() {
  const fabDock = document.getElementById("fabDock");
  const vaultFabDock = document.getElementById("vaultFabDock");
  const familyFabDock = document.getElementById("familyFabDock");
  if (fabDock) fabDock.hidden = true;
  if (vaultFabDock) vaultFabDock.hidden = true;
  if (familyFabDock) familyFabDock.hidden = true;
}

// --- Modal ---

function configureModalForCategory(category) {
  const config = CATEGORIES[category];
  els.labelTitle.textContent = config.titleLabel;
  els.labelSubtitle.textContent = config.subtitleLabel;
  els.amountRow.hidden = !config.showAmount;
  els.fieldAmount.required = false;
}

function setModalSaving(saving) {
  isSaving = saving;
  els.btnSave.disabled = saving;
  els.btnDelete.disabled = saving;
  els.btnSave.textContent = saving ? "Saving…" : "Save";
}

function openAddModal(category) {
  if (isLoading || !getClient()) return;
  if (!Access().canAccessCategory(category)) {
    showUpgradeAlert(category);
    return;
  }
  editingItem = null;
  const config = CATEGORIES[category];
  els.modalTitle.textContent = `Add ${config.label.toLowerCase()}`;
  els.itemForm.reset();
  els.itemId.value = "";
  els.itemCategory.value = category;
  els.btnDelete.hidden = true;
  configureModalForCategory(category);
  els.itemModal.showModal();
  els.fieldTitle.focus();
}

function openEditModal(category, id) {
  if (isLoading || !getClient()) return;
  const item = state[category].find((i) => i.id === id);
  if (!item) return;

  editingItem = { category, id };
  const config = CATEGORIES[category];
  els.modalTitle.textContent = `Edit ${config.label.toLowerCase()}`;
  els.itemId.value = id;
  els.itemCategory.value = category;
  els.fieldTitle.value = item.title;
  els.fieldSubtitle.value = item.subtitle || "";
  els.fieldDueDate.value = item.dueDate;
  els.fieldAmount.value = item.amount != null ? item.amount : "";
  els.fieldFrequency.value = item.frequency || "monthly";
  els.fieldNotes.value = item.notes || "";
  els.btnDelete.hidden = false;
  configureModalForCategory(category);
  els.itemModal.showModal();
}

function closeModal() {
  els.itemModal.close();
  editingItem = null;
  setModalSaving(false);
}

async function saveItem(formData) {
  const category = formData.get("category");
  const existingId = formData.get("id");

  if (!Access().canAccessCategory(category)) {
    showUpgradeAlert(category);
    return;
  }

  const list = state[category] || [];
  if (!existingId && !Access().canAddItem(category, list.length)) {
    alert(
      `Free plan limit: ${Access().getItemLimit()} items per category. ${Access().getUpgradeMessage(Access().FEATURES.ITEMS_UNLIMITED)}`
    );
    return;
  }

  const id = existingId || crypto.randomUUID();
  const amountRaw = formData.get("amount");
  const item = {
    id,
    title: formData.get("title").trim(),
    subtitle: (formData.get("subtitle") || "").trim(),
    dueDate: formData.get("dueDate"),
    amount: amountRaw !== "" && amountRaw != null ? parseFloat(amountRaw) : null,
    frequency: formData.get("frequency") || "monthly",
    notes: (formData.get("notes") || "").trim(),
  };

  setModalSaving(true);
  try {
    await upsertItem(category, item);

    const list = state[category];
    const idx = list.findIndex((i) => i.id === id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }

    renderAll();
    closeModal();
  } catch (err) {
    console.error(err);
    alert(`Could not save: ${err.message || "Unknown error"}`);
    setModalSaving(false);
  }
}

async function deleteItem() {
  if (!editingItem) return;
  const { category, id } = editingItem;

  setModalSaving(true);
  try {
    await deleteItemFromDb(id);
    state[category] = state[category].filter((i) => i.id !== id);
    renderAll();
    closeModal();
  } catch (err) {
    console.error(err);
    alert(`Could not delete: ${err.message || "Unknown error"}`);
    setModalSaving(false);
  }
}

// --- Init ---

async function init() {
  renderSideMenu();
  setFabOpen(false);
  setInteractable(false);

  window.LifeAdminBriefing.initBrainDump(brainDumpEls, {
    onCreateTasks: async (parsed) => {
      const created = await window.LifeAdminTasks.createTasksBulk(parsed);
      await renderAll();
      return created;
    },
  });

  const actionDraftModal = document.getElementById("actionDraftModal");
  const actionDraftSubject = document.getElementById("actionDraftSubject");
  const actionDraftBody = document.getElementById("actionDraftBody");
  document.getElementById("actionDraftClose")?.addEventListener("click", () =>
    actionDraftModal?.close()
  );
  document.getElementById("actionDraftCopy")?.addEventListener("click", async () => {
    const text = `${actionDraftSubject?.value || ""}\n\n${actionDraftBody?.value || ""}`;
    try {
      await navigator.clipboard.writeText(text);
      showBanner("loading", "Draft copied to clipboard.");
      setTimeout(hideBanner, 1800);
    } catch {
      showBanner("error", "Could not copy — select text manually.");
      setTimeout(hideBanner, 2500);
    }
  });

  window.LifeAdminActionUI.init(
    {
      actionSection: document.getElementById("actionCardsSection"),
      actionCount: document.getElementById("actionCardsCount"),
      actionList: document.getElementById("actionCardsList"),
    },
    {
      onOpenWorkflow: (id) => window.LifeAdminLifeEvents?.openWorkflowById?.(id),
      onStartWorkflow: async (workflowType) => {
        await window.LifeAdminLifeEvents?.startWorkflow?.(workflowType);
        switchView("life-events");
      },
      onOpenDocument: (docId) => {
        switchView("vault");
        setTimeout(() => {
          document
            .querySelector(`[data-vault-doc="${docId}"]`)
            ?.scrollIntoView?.({ behavior: "smooth" });
        }, 200);
      },
      onDraftEmail: ({ draft }) => {
        if (actionDraftSubject) actionDraftSubject.value = draft?.subject || "";
        if (actionDraftBody) actionDraftBody.value = draft?.body || "";
        actionDraftModal?.showModal?.();
      },
      onScheduleReminder: async (category, item) => {
        await createReminderFromWorkflow(category, item);
        showBanner("loading", "Reminder scheduled.");
        setTimeout(hideBanner, 1500);
        await renderAll();
      },
      onCreateTask: async (item) => {
        if (!getClient()) {
          window.LifeAdminTasks.openAddModal();
          return;
        }
        await window.LifeAdminTasks.createTaskQuick(item);
        await renderAll();
      },
      onOpenTask: (id) => window.LifeAdminTasks.openEditModal(id),
      onOpenCalendar: async (payload) => {
        switchView("planning");
        await window.LifeAdminPlanning?.loadTimeBlocks?.();
        window.LifeAdminPlanning?.openBlockModal?.({
          title: payload.title || "Appointment",
          blockDate: payload.dueDate || new Date().toISOString().slice(0, 10),
          startTime: "09:00:00",
          endTime: "10:00:00",
          category: "family",
          priority: "medium",
        });
      },
      onActionComplete: (action, opts) => {
        const msg = opts?.assisted
          ? `Done — ${action.title}`
          : `Opened — ${action.ctaLabel}`;
        showBanner("loading", msg);
        setTimeout(hideBanner, 2000);
      },
      onActionError: (err) => {
        showBanner("error", err.message || "Action failed");
        setTimeout(hideBanner, 2500);
      },
    }
  );

  const osTagline = document.getElementById("osTagline");
  if (osTagline && window.LifeAdminOS?.TAGLINE) {
    osTagline.textContent = window.LifeAdminOS.TAGLINE;
  }

  window.LifeAdminTodayOS.init(
    {
      familyOverview: document.getElementById("todayFamilyOverview"),
      familyList: document.getElementById("todayFamilyList"),
      familyMore: document.getElementById("todayFamilyMore"),
      quickActions: document.getElementById("todayQuickActions"),
      remindersStrip: document.getElementById("todayRemindersStrip"),
      remindersList: document.getElementById("todayRemindersList"),
      remindersMore: document.getElementById("todayRemindersMore"),
    },
    {
      onBrainDump: () => window.LifeAdminBriefing.openBrainDump?.(),
      onAddTask: () => window.LifeAdminTasks.openAddModal(),
      onAddReminder: () => {
        const cat = getFirstAccessibleCategory() || "mot";
        openAddModal(cat);
      },
      onOpenFamily: () => switchView("family"),
      onOpenNotifications: () => document.getElementById("btnBell")?.click(),
      onOpenReminder: (category, id) => openEditModal(category, id),
    }
  );

  window.LifeAdminAiPrompts.init(
    { promptGrid: document.getElementById("aiPromptGrid") },
    {
      onNavigate: navigateFromIntent,
      onFamilySummary: () => {
        const msg = window.LifeAdminAiChief.generateFamilySummary(getFullContextPayload());
        showBanner("loading", msg);
        setTimeout(hideBanner, 4000);
      },
      onRisksSummary: () => {
        const msg = window.LifeAdminAiChief.generateRisksSummary(getFullContextPayload());
        showBanner("loading", msg);
        setTimeout(hideBanner, 4000);
      },
    }
  );

  window.LifeAdminOSBindings.initAll();

  document.getElementById("btnTodayPill")?.addEventListener("click", () => {
    document.getElementById("btnBell")?.click();
  });

  window.LifeAdminContextEngine.init({
    getLiveContext: getFullContextPayload,
  });

  window.LifeAdminContextUI.init(
    {
      contextCard: document.getElementById("contextMemoryCard"),
      contextCount: document.getElementById("contextMemoryCount"),
      contextList: document.getElementById("contextMemoryList"),
      btnAddMemory: document.getElementById("btnAddMemory"),
      contextModal: document.getElementById("contextMemoryModal"),
      contextModalTitle: document.getElementById("contextModalTitle"),
      contextModalClose: document.getElementById("contextModalClose"),
      contextForm: document.getElementById("contextMemoryForm"),
      fieldMemoryCategory: document.getElementById("fieldMemoryCategory"),
      fieldMemoryTitle: document.getElementById("fieldMemoryTitle"),
      fieldMemoryBody: document.getElementById("fieldMemoryBody"),
    },
    {
      onContextChanged: async () => {
        await window.LifeAdminContextEngine.inferFromLiveData(getFullContextPayload());
        renderAiChief();
      },
    }
  );

  window.LifeAdminAiChief.init({
    aiUpgradeCard: document.getElementById("aiUpgradeCard"),
    aiUpgradeText: document.getElementById("aiUpgradeText"),
    aiContent: document.getElementById("aiContent"),
    aiGreeting: document.getElementById("aiGreeting"),
    aiStatTasks: document.getElementById("aiStatTasks"),
    aiStatReminders: document.getElementById("aiStatReminders"),
    aiStatUpcoming: document.getElementById("aiStatUpcoming"),
    aiActionsList: document.getElementById("aiActionsList"),
    aiHintsList: document.getElementById("aiHintsList"),
    btnPlanWeek: document.getElementById("btnPlanWeek"),
    aiWeeklyPlan: document.getElementById("aiWeeklyPlan"),
    aiPriorityList: document.getElementById("aiPriorityList"),
    aiBlocksList: document.getElementById("aiBlocksList"),
    aiWorkload: document.getElementById("aiWorkload"),
  });

  await window.LifeAdminFamily.init({
    familyUpgradeCard: document.getElementById("familyUpgradeCard"),
    familyUpgradeText: document.getElementById("familyUpgradeText"),
    familyContent: document.getElementById("familyContent"),
    familyMemberList: document.getElementById("familyMemberList"),
    familyMembersEmpty: document.getElementById("familyMembersEmpty"),
    familyReminderList: document.getElementById("familyReminderList"),
    familyRemindersEmpty: document.getElementById("familyRemindersEmpty"),
    familyTaskList: document.getElementById("familyTaskList"),
    familyTasksEmpty: document.getElementById("familyTasksEmpty"),
    familyInsightsList: document.getElementById("familyInsightsList"),
    familyFabDock: document.getElementById("familyFabDock"),
    familyFabAdd: document.getElementById("familyFabAdd"),
    btnAddFamilyReminder: document.getElementById("btnAddFamilyReminder"),
    btnAddFamilyTask: document.getElementById("btnAddFamilyTask"),
    familyMemberModal: document.getElementById("familyMemberModal"),
    familyMemberModalTitle: document.getElementById("familyMemberModalTitle"),
    familyMemberClose: document.getElementById("familyMemberClose"),
    familyMemberForm: document.getElementById("familyMemberForm"),
    fieldMemberId: document.getElementById("fieldMemberId"),
    fieldMemberName: document.getElementById("fieldMemberName"),
    fieldMemberRelationship: document.getElementById("fieldMemberRelationship"),
    fieldMemberRole: document.getElementById("fieldMemberRole"),
    fieldMemberDob: document.getElementById("fieldMemberDob"),
    btnMemberDelete: document.getElementById("btnMemberDelete"),
    btnMemberSave: document.getElementById("btnMemberSave"),
    familyReminderModal: document.getElementById("familyReminderModal"),
    familyReminderModalTitle: document.getElementById("familyReminderModalTitle"),
    familyReminderClose: document.getElementById("familyReminderClose"),
    familyReminderForm: document.getElementById("familyReminderForm"),
    fieldReminderId: document.getElementById("fieldReminderId"),
    fieldReminderTitle: document.getElementById("fieldReminderTitle"),
    fieldReminderDue: document.getElementById("fieldReminderDue"),
    fieldReminderMember: document.getElementById("fieldReminderMember"),
    fieldReminderSeverity: document.getElementById("fieldReminderSeverity"),
    btnReminderDelete: document.getElementById("btnReminderDelete"),
    btnReminderSave: document.getElementById("btnReminderSave"),
  });

  await window.LifeAdminVault.init({
    vaultSearch: document.getElementById("vaultSearch"),
    vaultFilters: document.getElementById("vaultFilters"),
    vaultDocList: document.getElementById("vaultDocList"),
    vaultEmpty: document.getElementById("vaultEmpty"),
    vaultFabAdd: document.getElementById("vaultFabAdd"),
    vaultFabMenu: document.getElementById("vaultFabMenu"),
    vaultScanModal: document.getElementById("vaultScanModal"),
    vaultScanClose: document.getElementById("vaultScanClose"),
    vaultScanTitle: document.getElementById("vaultScanTitle"),
    vaultScanForm: document.getElementById("vaultScanForm"),
    vaultScanFile: document.getElementById("vaultScanFile"),
    vaultScanSave: document.getElementById("vaultScanSave"),
    ocrPreview: document.getElementById("ocrPreview"),
    ocrPreviewTitle: document.getElementById("ocrPreviewTitle"),
    ocrPreviewBody: document.getElementById("ocrPreviewBody"),
    fieldVaultScanCategory: document.getElementById("fieldVaultScanCategory"),
    vaultManualModal: document.getElementById("vaultManualModal"),
    vaultManualTitle: document.getElementById("vaultManualTitle"),
    vaultManualClose: document.getElementById("vaultManualClose"),
    vaultManualForm: document.getElementById("vaultManualForm"),
    fieldVaultId: document.getElementById("fieldVaultId"),
    fieldVaultTitle: document.getElementById("fieldVaultTitle"),
    fieldVaultCategory: document.getElementById("fieldVaultCategory"),
    fieldVaultExpiry: document.getElementById("fieldVaultExpiry"),
    fieldVaultNotes: document.getElementById("fieldVaultNotes"),
    vaultDetailModal: document.getElementById("vaultDetailModal"),
    vaultDetailTitle: document.getElementById("vaultDetailTitle"),
    vaultDetailBody: document.getElementById("vaultDetailBody"),
    vaultDetailClose: document.getElementById("vaultDetailClose"),
    vaultDetailEdit: document.getElementById("vaultDetailEdit"),
    vaultDetailDelete: document.getElementById("vaultDetailDelete"),
  });

  window.LifeAdminTasks.init({
    taskCardList: document.getElementById("taskCardList"),
    taskCardListPage: document.getElementById("taskCardListPage"),
    tasksEmpty: document.getElementById("tasksEmpty"),
    tasksEmptyPage: document.getElementById("tasksEmptyPage"),
    btnAddTask: document.getElementById("btnAddTask"),
    taskModal: document.getElementById("taskModal"),
    taskForm: document.getElementById("taskForm"),
    taskModalTitle: document.getElementById("taskModalTitle"),
    taskModalClose: document.getElementById("taskModalClose"),
    btnTaskDelete: document.getElementById("btnTaskDelete"),
    btnTaskSave: document.getElementById("btnTaskSave"),
    btnTaskBreakDown: document.getElementById("btnTaskBreakDown"),
    fieldTaskId: document.getElementById("fieldTaskId"),
    fieldTaskTitle: document.getElementById("fieldTaskTitle"),
    fieldTaskDescription: document.getElementById("fieldTaskDescription"),
    fieldTaskCategory: document.getElementById("fieldTaskCategory"),
    fieldTaskPriority: document.getElementById("fieldTaskPriority"),
    fieldTaskDueDate: document.getElementById("fieldTaskDueDate"),
    fieldTaskStartDate: document.getElementById("fieldTaskStartDate"),
    fieldTaskDuration: document.getElementById("fieldTaskDuration"),
    fieldTaskTags: document.getElementById("fieldTaskTags"),
    fieldTaskRecurring: document.getElementById("fieldTaskRecurring"),
    taskRecurringFields: document.getElementById("taskRecurringFields"),
    fieldRecurringRule: document.getElementById("fieldRecurringRule"),
    fieldTaskProgress: document.getElementById("fieldTaskProgress"),
    fieldTaskSubtasks: document.getElementById("fieldTaskSubtasks"),
    taskBreakdown: document.getElementById("taskBreakdown"),
    taskBreakdownList: document.getElementById("taskBreakdownList"),
    fieldTaskAssignedTo: document.getElementById("fieldTaskAssignedTo"),
  }, {
    onTasksChanged: () => {
      renderDashboard();
      window.LifeAdminFamily?.renderFamily?.();
      refreshNotificationCenter();
      renderPlanning();
    },
  });

  await window.LifeAdminLifeEvents.init(
    {
      lifeEventsUpgrade: document.getElementById("lifeEventsUpgrade"),
      lifeEventsUpgradeText: document.getElementById("lifeEventsUpgradeText"),
      lifeEventsMain: document.getElementById("lifeEventsMain"),
      lifeEventsPicker: document.getElementById("lifeEventsPicker"),
      lifeEventsDetail: document.getElementById("lifeEventsDetail"),
      lifeEventsActiveList: document.getElementById("lifeEventsActiveList"),
      lifeEventsWorkflowGrid: document.getElementById("lifeEventsWorkflowGrid"),
      leBackBtn: document.getElementById("leBackBtn"),
      leDetailTitle: document.getElementById("leDetailTitle"),
      leDetailIcon: document.getElementById("leDetailIcon"),
      leTargetDate: document.getElementById("leTargetDate"),
      leProgressBar: document.getElementById("leProgressBar"),
      leProgressPct: document.getElementById("leProgressPct"),
      leProgressMeta: document.getElementById("leProgressMeta"),
      leChecklist: document.getElementById("leChecklist"),
      leTimeline: document.getElementById("leTimeline"),
      leDocuments: document.getElementById("leDocuments"),
      leAiHints: document.getElementById("leAiHints"),
      leTaskCount: document.getElementById("leTaskCount"),
      btnSyncTasks: document.getElementById("btnSyncTasks"),
      btnSyncReminders: document.getElementById("btnSyncReminders"),
      btnArchiveWorkflow: document.getElementById("btnArchiveWorkflow"),
      startWorkflowModal: document.getElementById("startWorkflowModal"),
      startWorkflowForm: document.getElementById("startWorkflowForm"),
      startWorkflowTitle: document.getElementById("startWorkflowTitle"),
      startWorkflowClose: document.getElementById("startWorkflowClose"),
      fieldWorkflowTarget: document.getElementById("fieldWorkflowTarget"),
    },
    {
      onCreateReminder: createReminderFromWorkflow,
      onNavigate: navigateFromIntent,
      onActivateWorkflow: workflowIntentHandlers.onActivateWorkflow,
      onWorkflowChanged: async () => {
        state = await loadFromSupabase().catch(() => state);
        await window.LifeAdminTasks.loadTasks().catch(() => null);
        renderDashboard();
        renderLifeEvents();
        refreshNotificationCenter();
        window.LifeAdminTasks.renderTaskCards();
        window.LifeAdminWorkflowUI?.renderWorkflowCards?.();
      },
    }
  );

  await window.LifeAdminPlanning.init(
    {
      planUpgradeCard: document.getElementById("planUpgradeCard"),
      planUpgradeText: document.getElementById("planUpgradeText"),
      planContent: document.getElementById("planContent"),
      planViewTabs: document.getElementById("planViewTabs"),
      planNavLabel: document.getElementById("planNavLabel"),
      planNavPrev: document.getElementById("planNavPrev"),
      planNavNext: document.getElementById("planNavNext"),
      planNavToday: document.getElementById("planNavToday"),
      planCalendar: document.getElementById("planCalendar"),
      planUnscheduled: document.getElementById("planUnscheduled"),
      planFamilyEvents: document.getElementById("planFamilyEvents"),
      btnPlanWeek: document.getElementById("btnPlanWeek"),
      btnAddTimeBlock: document.getElementById("btnAddTimeBlock"),
      planAiResult: document.getElementById("planAiResult"),
      planWorkload: document.getElementById("planWorkload"),
      planScheduleList: document.getElementById("planScheduleList"),
      planFamilyPriorityList: document.getElementById("planFamilyPriorityList"),
      planBlockSuggestions: document.getElementById("planBlockSuggestions"),
      timeBlockModal: document.getElementById("timeBlockModal"),
      timeBlockForm: document.getElementById("timeBlockForm"),
      timeBlockClose: document.getElementById("timeBlockClose"),
      fieldBlockId: document.getElementById("fieldBlockId"),
      fieldBlockTitle: document.getElementById("fieldBlockTitle"),
      fieldBlockDate: document.getElementById("fieldBlockDate"),
      fieldBlockStart: document.getElementById("fieldBlockStart"),
      fieldBlockEnd: document.getElementById("fieldBlockEnd"),
      fieldBlockCategory: document.getElementById("fieldBlockCategory"),
      fieldBlockPriority: document.getElementById("fieldBlockPriority"),
      btnBlockDelete: document.getElementById("btnBlockDelete"),
    },
    {
      onPlanningChanged: () => {
        renderDashboard();
        refreshNotificationCenter();
      },
    }
  );

  window.LifeAdminNotificationCenter.init(
    {
      btnBell: document.getElementById("btnBell"),
      headerNotificationBadge: document.getElementById("headerNotificationBadge"),
      headerBellDot: document.getElementById("headerBellDot"),
      notificationCenter: document.getElementById("notificationCenter"),
      notificationClose: document.getElementById("notificationClose"),
      notificationFilters: document.getElementById("notificationFilters"),
      notificationList: document.getElementById("notificationList"),
      notificationEmpty: document.getElementById("notificationEmpty"),
      ncUnreadSummary: document.getElementById("ncUnreadSummary"),
    },
    {
      onOpenReminder: (category, id) => openEditModal(category, id),
      onOpenTask: (id) => window.LifeAdminTasks.openEditModal(id),
      onOpenVault: (docId) => {
        switchView("vault");
        setTimeout(() => {
          document.querySelector(`[data-vault-doc="${docId}"]`)?.scrollIntoView?.({
            behavior: "smooth",
          });
        }, 150);
      },
      onOpenFamilyReminder: (id) => {
        switchView("family");
        window.LifeAdminFamily?.openReminderModal?.(id);
      },
      onOpenAi: () => switchView("ai"),
    }
  );

  window.LifeAdminWorkflowUI.initIntent(
    {
      intentForm: document.getElementById("intentForm"),
      intentInput: document.getElementById("intentInput"),
      intentExamples: document.getElementById("intentExamples"),
      intentResult: document.getElementById("intentResult"),
      intentResultIcon: document.getElementById("intentResultIcon"),
      intentResultSummary: document.getElementById("intentResultSummary"),
      intentPlanMeta: document.getElementById("intentPlanMeta"),
      intentActions: document.getElementById("intentActions"),
      intentForgetSection: document.getElementById("intentForgetSection"),
      intentForgetting: document.getElementById("intentForgetting"),
      intentContextSection: document.getElementById("intentContextSection"),
      intentContextList: document.getElementById("intentContextList"),
      intentToggleDay: document.getElementById("intentToggleDay"),
    },
    {
      ...workflowIntentHandlers,
      onStartWorkflow: async (workflowType) => {
        await window.LifeAdminLifeEvents?.startWorkflow?.(workflowType);
        switchView("life-events");
      },
    }
  );

  window.LifeAdminWorkflowUI.initCards(
    {
      workflowCardsList: document.getElementById("workflowCardsList"),
      workflowCardsSection: document.getElementById("workflowCardsSection"),
    },
    {
      onOpenWorkflow: (id) => window.LifeAdminLifeEvents?.openWorkflowById?.(id),
    }
  );

  await window.LifeAdminProfile.initUserContext();

  if (!getClient()) {
    window.LifeAdminDeploy?.markBooted?.();
    showBanner("error", window.supabaseConfigError);
    await renderAll();
    return;
  }

  window.LifeAdminDeploy?.showLoader?.("Loading your reminders…");
  showBanner("loading", "Loading your reminders…");
  isLoading = true;

  try {
    const [reminderState] = await Promise.all([
      loadFromSupabase(),
      window.LifeAdminTasks.loadTasks().catch((e) => {
        console.warn("Tasks load failed:", e);
        return [];
      }),
      window.LifeAdminFamily.loadAll().catch((e) => {
        console.warn("Family load failed:", e);
        return null;
      }),
    ]);
    state = reminderState;
    hideBanner();
    setInteractable(true);
    window.LifeAdminTasks.renderTaskCards();
    await renderAll();
    refreshNotificationCenter();
    if (window.LifeAdminOnboarding?.isComplete?.()) {
      window.LifeAdminDeploy?.markBooted?.();
    }
  } catch (err) {
    console.error(err);
    const msg = err.message || "Check Supabase setup";
    showBanner("error", `Could not load data: ${msg}`);
    if (window.LifeAdminOnboarding?.isComplete?.()) {
      window.LifeAdminDeploy?.showFatalError?.("Could not load your data", msg);
    }
    await renderAll();
  } finally {
    isLoading = false;
  }

  $$(".tab-bar__item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.nav));
  });

  document.querySelectorAll("[data-nav-jump]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.navJump));
  });

  uiEls.fabAdd?.addEventListener("click", () => {
    const open = uiEls.fabMenu && !uiEls.fabMenu.hidden;
    setFabOpen(!open);
  });

  uiEls.fabMenu?.querySelectorAll("[data-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFabOpen(false);
      handleQuickAction(btn.dataset.quick);
    });
  });

  uiEls.filterTasks?.addEventListener("click", () => toggleFilterPanel("tasks"));
  uiEls.filterUpcoming?.addEventListener("click", () => toggleFilterPanel("upcoming"));

  uiEls.btnMenu?.addEventListener("click", () => uiEls.sideMenu?.showModal());
  uiEls.sideMenuClose?.addEventListener("click", () => uiEls.sideMenu?.close());
  uiEls.sideMenu?.addEventListener("click", (e) => {
    if (e.target === uiEls.sideMenu) uiEls.sideMenu.close();
  });

  document.addEventListener("click", (e) => {
    if (uiEls.fabMenu?.classList.contains("is-open") && !e.target.closest(".fab-wrap")) {
      setFabOpen(false);
    }
  });

  els.modalClose.addEventListener("click", closeModal);
  els.itemModal.addEventListener("click", (e) => {
    if (e.target === els.itemModal) closeModal();
  });

  els.itemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isSaving) saveItem(new FormData(els.itemForm));
  });

  els.btnDelete.addEventListener("click", () => {
    if (confirm("Delete this item?")) deleteItem();
  });
}

function wireSurfaceExpansion() {
  const app = document.querySelector(".app");
  const scroll = document.getElementById("todayScroll");
  if (!app) return;

  const expand = () => app.classList.add("app--expanded");

  scroll?.addEventListener(
    "scroll",
    () => {
      if (scroll.scrollTop > 48) expand();
    },
    { passive: true }
  );

  document.getElementById("btnMenu")?.addEventListener("click", expand);
  document.querySelector(".tab-bar")?.addEventListener("click", expand);
}

let appBooted = false;

async function ensureAppBooted() {
  if (appBooted) return;
  appBooted = true;
  await init();
}

async function enterMainApp() {
  window.LifeAdminDeploy?.showLoader?.("Preparing your day…");
  const app = document.querySelector(".app");
  if (app) {
    app.classList.remove("app--gated");
    if (!app.classList.contains("app--expanded")) {
      app.classList.add("app--surface-only");
    }
  }
  try {
    await ensureAppBooted();
  } catch (err) {
    window.LifeAdminDeploy?.showFatalError?.(
      "Could not load your data",
      err.message || "Check Supabase configuration"
    );
    throw err;
  }
  window.LifeAdminDeploy?.markBooted?.();
  wireSurfaceExpansion();
  switchView("dashboard");
  const firstIntent = localStorage.getItem("life_admin_first_intent");
  if (firstIntent) {
    const input = document.getElementById("intentInput");
    if (input && !input.value) input.value = firstIntent;
    localStorage.removeItem("life_admin_first_intent");
  }
  showBanner("loading", "Welcome — we've got the rest.");
  setTimeout(hideBanner, 2200);
}

async function startApplication() {
  try {
    await runStartApplication();
  } catch (err) {
    console.error(err);
    window.LifeAdminDeploy?.showFatalError?.(
      "Life Admin could not start",
      err?.message || "Unknown error"
    );
  }
}

async function runStartApplication() {
  const shell = document.getElementById("onboardingShell");
  const screens = shell ? [...shell.querySelectorAll("[data-onboarding-step]")] : [];

  const onboardingShown = window.LifeAdminOnboarding?.init?.(
    {
      shell,
      screens,
      getStarted: document.getElementById("onboardingGetStarted"),
      authGoogle: document.getElementById("onboardingAuthGoogle"),
      authApple: document.getElementById("onboardingAuthApple"),
      authEmail: document.getElementById("onboardingAuthEmail"),
      emailForm: document.getElementById("onboardingEmailForm"),
      emailInput: document.getElementById("onboardingEmailInput"),
      skipAuth: document.getElementById("onboardingSkipAuth"),
      userName: document.getElementById("onboardingUserName"),
      entryPhase: document.getElementById("onboardingEntryPhase"),
      detailsPhase: document.getElementById("onboardingDetailsPhase"),
      reminderInput: document.getElementById("onboardingReminderInput"),
      livePrompt: document.getElementById("onboardingLivePrompt"),
      promptText: document.getElementById("onboardingPromptText"),
      promptSub: document.getElementById("onboardingPromptSub"),
      detailsLead: document.getElementById("onboardingDetailsLead"),
      detailsForm: document.getElementById("onboardingDetailsForm"),
      detailTitleLabel: document.getElementById("onboardingDetailTitleLabel"),
      detailTitle: document.getElementById("onboardingDetailTitle"),
      detailDueDate: document.getElementById("onboardingDetailDueDate"),
      detailPriorityWrap: document.getElementById("onboardingDetailPriorityWrap"),
      detailPriority: document.getElementById("onboardingDetailPriority"),
      detailNotesWrap: document.getElementById("onboardingDetailNotesWrap"),
      detailNotes: document.getElementById("onboardingDetailNotes"),
      detailsSave: document.getElementById("onboardingDetailsSave"),
      detailsBack: document.getElementById("onboardingDetailsBack"),
      reminderStatus: document.getElementById("onboardingReminderStatus"),
      completeTitle: document.getElementById("onboardingCompleteTitle"),
      completeSub: document.getElementById("onboardingCompleteSub"),
      completeList: document.getElementById("onboardingCompleteList"),
      addAnother: document.getElementById("onboardingAddAnother"),
      enterApp: document.getElementById("onboardingEnterApp"),
    },
    {
      onEnterApp: enterMainApp,
      onCreateReminder: async (category, item) => {
        if (!getClient()) return;
        await createReminderFromWorkflow(category, item);
      },
      onCreateTask: async (item) => {
        if (!getClient()) return;
        await window.LifeAdminTasks.createTaskQuick(item);
      },
    }
  );

  if (!onboardingShown) {
    document.body.classList.add("onboarding-done");
    await enterMainApp();
    return;
  }

  window.LifeAdminDeploy?.hideLoader?.();
  document.querySelector(".app")?.classList.add("app--gated");
  ensureAppBooted().catch((err) => {
    console.warn("Background preload:", err.message);
    window.LifeAdminDeploy?.hideLoader?.();
  });
}

window.LifeAdminApp = {
  switchView,
  renderAll,
  renderAiChief,
  openEditModal,
  refreshNotificationCenter,
  enterMainApp,
  showError: showAppError,
  resetOnboarding: () => {
    window.LifeAdminOnboarding?.resetForDev?.();
    localStorage.removeItem("life_admin_first_intent");
    location.reload();
  },
};

startApplication();
