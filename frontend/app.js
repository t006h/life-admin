/**
 * Life Admin — personal chief-of-staff for life administration
 * Data persisted in Supabase (life_admin_items table)
 */

const TABLE = "life_admin_items";

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
  };
}

function itemToRow(item, category) {
  return {
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
  const { error } = await client.from(TABLE).upsert(itemToRow(item, category));
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
    .filter((item) => item.notify)
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

const els = {
  appBanner: $("#appBanner"),
  appBannerText: $("#appBannerText"),
  todayDate: $("#todayDate"),
  prioritiesCard: $("#prioritiesCard"),
  prioritiesList: $("#prioritiesList"),
  prioritiesBadge: $("#prioritiesBadge"),
  notificationBadge: $("#notificationBadge"),
  notificationBadgeCount: $("#notificationBadgeCount"),
  navNotificationBadge: $("#navNotificationBadge"),
  dashboardSummary: $("#dashboardSummary"),
  dashboardStats: $("#dashboardStats"),
  todayList: $("#todayList"),
  todayEmpty: $("#todayEmpty"),
  fabAdd: $("#fabAdd"),
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

function hideBanner() {
  els.appBanner.hidden = true;
}

function setInteractable(enabled) {
  els.fabAdd.disabled = !enabled;
  $$(".nav__item").forEach((btn) => {
    btn.disabled = !enabled;
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

function renderPriorityItem(item) {
  const { config, urgency, days, title, category } = item;
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `priority-item${urgency === "urgent" ? " priority-item--urgent" : ""}`;
  btn.innerHTML = `
    <span class="priority-item__icon" aria-hidden="true">${config.icon}</span>
    <span class="priority-item__body">
      <span class="priority-item__title">${escapeHtml(title)}</span>
      <span class="priority-item__meta">${escapeHtml(config.label)} · ${escapeHtml(urgencyLabel(days, category, item.dueDate))}</span>
    </span>
    <span class="priority-item__tag">${urgency === "urgent" ? "Urgent" : "Soon"}</span>
  `;
  btn.addEventListener("click", () => openEditModal(category, item.id));
  li.appendChild(btn);
  return li;
}

function updateNotificationBadges(count) {
  const show = count > 0;
  els.notificationBadge.hidden = !show;
  els.navNotificationBadge.hidden = !show;
  els.prioritiesBadge.hidden = !show;
  const text = count > 99 ? "99+" : String(count);
  els.notificationBadgeCount.textContent = text;
  els.navNotificationBadge.textContent = text;
  els.prioritiesBadge.textContent = text;
  els.notificationBadge.setAttribute("aria-label", `${count} notification${count === 1 ? "" : "s"}`);
}

function renderPrioritiesCard(notifications) {
  const urgent = notifications.filter((n) => n.urgency === "urgent");
  const toShow = urgent.length > 0 ? urgent.slice(0, 5) : notifications.slice(0, 3);

  els.prioritiesCard.hidden = notifications.length === 0;
  els.prioritiesList.replaceChildren();

  if (notifications.length === 0) return;

  if (toShow.length === 0) {
    const empty = document.createElement("p");
    empty.className = "priorities-card__empty";
    empty.textContent = "No urgent items — review upcoming reminders below.";
    els.prioritiesList.appendChild(empty);
    return;
  }

  for (const item of toShow) {
    els.prioritiesList.appendChild(renderPriorityItem(item));
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

function renderDashboard() {
  const all = getAllItems();
  const notifications = getNotifications();
  const today = getTodayItems();
  const urgentCount = notifications.filter((i) => i.urgency === "urgent").length;
  const warningCount = notifications.filter((i) => i.urgency === "warning").length;
  const okCount = all.length - notifications.length;

  updateNotificationBadges(notifications.length);
  renderPrioritiesCard(notifications);

  els.dashboardStats.innerHTML = `
    <div class="stat-pill stat-pill--urgent">
      <span class="stat-pill__value">${urgentCount}</span>
      <span class="stat-pill__label">Urgent</span>
    </div>
    <div class="stat-pill stat-pill--warning">
      <span class="stat-pill__value">${warningCount}</span>
      <span class="stat-pill__label">Soon</span>
    </div>
    <div class="stat-pill stat-pill--ok">
      <span class="stat-pill__value">${Math.max(0, okCount)}</span>
      <span class="stat-pill__label">On track</span>
    </div>
  `;

  if (notifications.length === 0) {
    els.dashboardSummary.textContent =
      all.length === 0
        ? "Add your first reminder to get started."
        : "Nothing needs attention right now.";
    els.todayEmpty.hidden = false;
  } else {
    els.dashboardSummary.textContent = `${notifications.length} notification${notifications.length === 1 ? "" : "s"} — ${urgentCount} urgent`;
    els.todayEmpty.hidden = true;
  }

  renderList(els.todayList, today, els.todayEmpty);
}

function renderCategory(category) {
  const { list, empty } = listEls[category];
  renderList(list, getCategoryItems(category), empty);
}

function renderAll() {
  renderDashboard();
  for (const cat of Object.keys(CATEGORIES)) {
    renderCategory(cat);
  }
}

function updateHeaderDate() {
  const now = new Date();
  els.todayDate.textContent = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  els.todayDate.dateTime = now.toISOString().slice(0, 10);
}

// --- Navigation ---

function switchView(view) {
  currentView = view;
  $$(".view").forEach((el) => {
    el.classList.toggle("view--active", el.dataset.view === view);
  });
  $$(".nav__item").forEach((btn) => {
    const active = btn.dataset.nav === view;
    btn.classList.toggle("nav__item--active", active);
    btn.setAttribute("aria-current", active ? "page" : null);
  });
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
  updateHeaderDate();
  setInteractable(false);

  if (!getClient()) {
    showBanner("error", window.supabaseConfigError);
    renderAll();
    return;
  }

  showBanner("loading", "Loading your reminders…");
  isLoading = true;

  try {
    state = await loadFromSupabase();
    hideBanner();
    setInteractable(true);
    renderAll();
  } catch (err) {
    console.error(err);
    showBanner("error", `Could not load data: ${err.message || "Check Supabase setup"}`);
    renderAll();
  } finally {
    isLoading = false;
  }

  $$(".nav__item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.nav));
  });

  els.fabAdd.addEventListener("click", () => {
    const category = currentView === "dashboard" ? "mot" : currentView;
    if (CATEGORIES[category]) {
      openAddModal(category);
    } else {
      openAddModal("mot");
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

init();
