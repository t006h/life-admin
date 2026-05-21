/**
 * Life Admin — task capture, recurring engine, task cards
 */
(function () {
  const TABLE = "life_admin_tasks";

  const RECURRING_RULES = Object.freeze({
    daily: { label: "Daily", days: 1 },
    weekly: { label: "Weekly", days: 7 },
    biweekly: { label: "Every 2 weeks", days: 14 },
    monthly: { label: "Monthly", months: 1 },
    every_90_days: { label: "Every 90 days", days: 90 },
    first_monday: { label: "First Monday", special: "first_monday" },
  });

  const PRIORITIES = Object.freeze({
    low: { label: "Low", class: "priority--low" },
    medium: { label: "Medium", class: "priority--medium" },
    high: { label: "High", class: "priority--high" },
  });

  const ASSIGN_TO = Object.freeze(["me", "partner", "child", "everyone"]);

  const ASSIGN_LABELS = Object.freeze({
    me: "Me",
    partner: "Partner",
    child: "Child",
    everyone: "Everyone",
  });

  const TASK_CATEGORIES = [
    { value: "general", label: "General" },
    { value: "family", label: "Family" },
    { value: "mot", label: "MOT" },
    { value: "passport", label: "Passport" },
    { value: "licence", label: "Driving licence" },
    { value: "subscriptions", label: "Subscriptions" },
    { value: "bills", label: "Bills" },
    { value: "documents", label: "Documents" },
  ];

  let tasks = [];
  let editingTaskId = null;
  let els = {};
  let onTasksChanged = null;

  function getClient() {
    return window.supabaseClient;
  }

  function parseTags(raw) {
    if (!raw || !String(raw).trim()) return [];
    return String(raw)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  function rowToTask(row) {
    return {
      id: row.id,
      title: row.title || "",
      description: row.description || "",
      category: row.category || "general",
      priority: row.priority || "medium",
      dueDate: row.due_date || "",
      startDate: row.start_date || "",
      estimatedDuration: row.estimated_duration_minutes,
      tags: Array.isArray(row.tags) ? row.tags : [],
      isRecurring: Boolean(row.is_recurring),
      recurringRule: row.recurring_rule || "",
      progress: row.progress != null ? row.progress : 0,
      subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
      assignedTo: ASSIGN_TO.includes(row.assigned_to) ? row.assigned_to : "me",
    };
  }

  function taskToRow(task) {
    return {
      id: task.id,
      title: task.title,
      description: task.description || "",
      category: task.category || "general",
      priority: task.priority || "medium",
      due_date: task.dueDate || null,
      start_date: task.startDate || null,
      estimated_duration_minutes: task.estimatedDuration || null,
      tags: task.tags || [],
      is_recurring: task.isRecurring,
      recurring_rule: task.isRecurring ? task.recurringRule || null : null,
      progress: task.progress ?? 0,
      subtasks: task.subtasks || [],
      assigned_to: task.assignedTo || "me",
      updated_at: new Date().toISOString(),
    };
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function addDays(dateStr, days) {
    const d = startOfDay(new Date(dateStr + "T12:00:00"));
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function addMonths(dateStr, months) {
    const d = new Date(dateStr + "T12:00:00");
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }

  /** Recurring engine — compute next occurrence from a due date */
  function getNextDueDate(fromDateStr, rule) {
    if (!fromDateStr || !rule || !RECURRING_RULES[rule]) return fromDateStr;
    const cfg = RECURRING_RULES[rule];

    if (cfg.special === "first_monday") {
      const d = new Date(fromDateStr + "T12:00:00");
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    if (cfg.months) return addMonths(fromDateStr, cfg.months);
    if (cfg.days) return addDays(fromDateStr, cfg.days);
    return fromDateStr;
  }

  function formatDue(dateStr) {
    if (!dateStr) return "No due date";
    const today = startOfDay(new Date());
    const due = startOfDay(new Date(dateStr + "T12:00:00"));
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function computeProgressFromSubtasks(subtasks) {
    if (!subtasks.length) return 0;
    const done = subtasks.filter((s) => s.done).length;
    return Math.round((done / subtasks.length) * 100);
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  async function loadTasks() {
    const client = getClient();
    if (!client) return [];
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    tasks = (data || []).map(rowToTask);
    return tasks;
  }

  async function saveTask(task) {
    const client = getClient();
    const { error } = await client.from(TABLE).upsert(taskToRow(task));
    if (error) throw error;
  }

  async function deleteTask(id) {
    const client = getClient();
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  }

  async function createTasksBulk(taskList) {
    const created = [];
    for (const task of taskList) {
      await saveTask(task);
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) tasks[idx] = task;
      else tasks.push(task);
      created.push(task);
    }
    renderTaskCards();
    if (onTasksChanged) onTasksChanged(tasks);
    return created;
  }

  function getTasks() {
    return tasks;
  }

  function getTasksDueSoon(days = 7) {
    const today = startOfDay(new Date());
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = startOfDay(new Date(t.dueDate + "T12:00:00"));
      const diff = Math.round((due - today) / 86400000);
      return diff >= 0 && diff <= days;
    });
  }

  function toggleRecurringFields(show) {
    els.taskRecurringFields.hidden = !show;
    els.fieldRecurringRule.required = show;
  }

  function renderBreakdown(subtasks) {
    els.taskBreakdown.hidden = !subtasks.length;
    els.taskBreakdownList.replaceChildren();
    subtasks.forEach((step, i) => {
      const li = document.createElement("li");
      li.className = "task-breakdown__item";
      li.innerHTML = `<span class="task-breakdown__num">${i + 1}</span><span>${escape(step.label)}</span>`;
      els.taskBreakdownList.appendChild(li);
    });
  }

  function readForm() {
    const tags = parseTags(els.fieldTaskTags.value);
    const isRecurring = els.fieldTaskRecurring.checked;
    const subtasks = JSON.parse(els.fieldTaskSubtasks.value || "[]");
    const progress =
      subtasks.length > 0
        ? computeProgressFromSubtasks(subtasks)
        : parseInt(els.fieldTaskProgress.value, 10) || 0;

    return {
      id: els.fieldTaskId.value || crypto.randomUUID(),
      title: els.fieldTaskTitle.value.trim(),
      description: els.fieldTaskDescription.value.trim(),
      category: els.fieldTaskCategory.value,
      priority: els.fieldTaskPriority.value,
      dueDate: els.fieldTaskDueDate.value,
      startDate: els.fieldTaskStartDate.value,
      estimatedDuration: els.fieldTaskDuration.value
        ? parseInt(els.fieldTaskDuration.value, 10)
        : null,
      tags,
      isRecurring,
      recurringRule: isRecurring ? els.fieldRecurringRule.value : "",
      progress: Math.min(100, Math.max(0, progress)),
      subtasks,
      assignedTo: els.fieldTaskAssignedTo?.value || "me",
    };
  }

  function fillForm(task) {
    els.fieldTaskId.value = task.id || "";
    els.fieldTaskTitle.value = task.title || "";
    els.fieldTaskDescription.value = task.description || "";
    els.fieldTaskCategory.value = task.category || "general";
    els.fieldTaskPriority.value = task.priority || "medium";
    els.fieldTaskDueDate.value = task.dueDate || "";
    els.fieldTaskStartDate.value = task.startDate || "";
    els.fieldTaskDuration.value =
      task.estimatedDuration != null ? task.estimatedDuration : "";
    els.fieldTaskTags.value = (task.tags || []).join(", ");
    els.fieldTaskRecurring.checked = task.isRecurring;
    els.fieldRecurringRule.value = task.recurringRule || "weekly";
    els.fieldTaskProgress.value = task.progress ?? 0;
    els.fieldTaskSubtasks.value = JSON.stringify(task.subtasks || []);
    toggleRecurringFields(task.isRecurring);
    renderBreakdown(task.subtasks || []);
    if (els.fieldTaskAssignedTo) {
      els.fieldTaskAssignedTo.value = task.assignedTo || "me";
    }
  }

  function openAddModal() {
    if (!getClient()) return;
    editingTaskId = null;
    els.taskModalTitle.textContent = "Add task";
    els.taskForm.reset();
    els.fieldTaskId.value = "";
    els.fieldTaskSubtasks.value = "[]";
    els.fieldTaskProgress.value = "0";
    els.btnTaskDelete.hidden = true;
    toggleRecurringFields(false);
    els.taskBreakdown.hidden = true;
    els.taskModal.showModal();
    els.fieldTaskTitle.focus();
  }

  function openEditModal(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    editingTaskId = id;
    els.taskModalTitle.textContent = "Edit task";
    fillForm(task);
    els.btnTaskDelete.hidden = false;
    els.taskModal.showModal();
  }

  function closeModal() {
    els.taskModal.close();
    editingTaskId = null;
  }

  async function handleSave(e) {
    e.preventDefault();
    const task = readForm();
    if (!task.title) return;

    els.btnTaskSave.disabled = true;
    els.btnTaskSave.textContent = "Saving…";
    try {
      await saveTask(task);
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) tasks[idx] = task;
      else tasks.push(task);
      closeModal();
      renderTaskCards();
      if (onTasksChanged) onTasksChanged(tasks);
    } catch (err) {
      alert(`Could not save task: ${err.message}`);
    } finally {
      els.btnTaskSave.disabled = false;
      els.btnTaskSave.textContent = "Save";
    }
  }

  async function handleDelete() {
    if (!editingTaskId || !confirm("Delete this task?")) return;
    try {
      await deleteTask(editingTaskId);
      tasks = tasks.filter((t) => t.id !== editingTaskId);
      closeModal();
      renderTaskCards();
      if (onTasksChanged) onTasksChanged(tasks);
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
    }
  }

  function handleBreakDown() {
    const title = els.fieldTaskTitle.value.trim();
    if (!title) {
      alert("Enter a task title first.");
      return;
    }
    const steps = window.LifeAdminTaskAI.breakDownTask(
      title,
      els.fieldTaskDescription.value
    );
    els.fieldTaskSubtasks.value = JSON.stringify(steps);
    els.fieldTaskProgress.value = String(computeProgressFromSubtasks(steps));
    renderBreakdown(steps);
  }

  function renderTaskCard(task) {
    const pri = PRIORITIES[task.priority] || PRIORITIES.medium;
    const nextDue =
      task.isRecurring && task.dueDate && task.recurringRule
        ? getNextDueDate(task.dueDate, task.recurringRule)
        : null;

    const card = document.createElement("button");
    card.type = "button";
    card.className = `task-card ${pri.class}`;
    card.dataset.id = task.id;

    const tagHtml = (task.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="task-card__tag">${escape(t)}</span>`)
      .join("");

    const recurringLabel = task.isRecurring
      ? RECURRING_RULES[task.recurringRule]?.label || "Recurring"
      : "";
    const assignLabel = ASSIGN_LABELS[task.assignedTo] || "Me";
    const showAssign = task.assignedTo && task.assignedTo !== "me";

    card.innerHTML = `
      <div class="task-card__top">
        <h4 class="task-card__title">${escape(task.title)}</h4>
        <span class="task-card__priority">${pri.label}</span>
      </div>
      ${
        task.description
          ? `<p class="task-card__desc">${escape(task.description)}</p>`
          : ""
      }
      <div class="task-card__progress-wrap">
        <div class="task-card__progress-bar" style="width:${task.progress}%"></div>
      </div>
      <div class="task-card__meta">
        ${showAssign ? `<span class="task-card__assign">${escape(assignLabel)}</span>` : ""}
        <span>${escape(formatDue(task.dueDate))}</span>
        ${
          recurringLabel
            ? `<span class="task-card__recurring" title="${
                nextDue ? `Next: ${formatDue(nextDue)}` : ""
              }">↻ ${escape(recurringLabel)}</span>`
            : ""
        }
        ${
          task.estimatedDuration
            ? `<span>${task.estimatedDuration} min</span>`
            : ""
        }
      </div>
      ${tagHtml ? `<div class="task-card__tags">${tagHtml}</div>` : ""}
      ${
        task.subtasks.length
          ? `<p class="task-card__steps">${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length} steps</p>`
          : ""
      }
    `;
    card.addEventListener("click", () => openEditModal(task.id));
    return card;
  }

  function fillTaskList(container, emptyEl, limit) {
    if (!container) return;
    container.replaceChildren();

    const sorted = [...tasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      const pa = order[a.priority] ?? 1;
      const pb = order[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });

    if (sorted.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    const slice = limit ? sorted.slice(0, limit) : sorted;
    slice.forEach((t) => container.appendChild(renderTaskCard(t)));
  }

  function renderTaskCards() {
    fillTaskList(els.taskCardList, els.tasksEmpty, 10);
    fillTaskList(els.taskCardListPage, els.tasksEmptyPage, null);
  }

  function bindElements(dom) {
    els = {
      taskCardList: dom.taskCardList,
      taskCardListPage: dom.taskCardListPage,
      tasksEmpty: dom.tasksEmpty,
      tasksEmptyPage: dom.tasksEmptyPage,
      taskModal: dom.taskModal,
      taskForm: dom.taskForm,
      taskModalTitle: dom.taskModalTitle,
      taskModalClose: dom.taskModalClose,
      btnTaskDelete: dom.btnTaskDelete,
      btnTaskSave: dom.btnTaskSave,
      btnTaskBreakDown: dom.btnTaskBreakDown,
      fieldTaskId: dom.fieldTaskId,
      fieldTaskTitle: dom.fieldTaskTitle,
      fieldTaskDescription: dom.fieldTaskDescription,
      fieldTaskCategory: dom.fieldTaskCategory,
      fieldTaskPriority: dom.fieldTaskPriority,
      fieldTaskDueDate: dom.fieldTaskDueDate,
      fieldTaskStartDate: dom.fieldTaskStartDate,
      fieldTaskDuration: dom.fieldTaskDuration,
      fieldTaskTags: dom.fieldTaskTags,
      fieldTaskRecurring: dom.fieldTaskRecurring,
      taskRecurringFields: dom.taskRecurringFields,
      fieldRecurringRule: dom.fieldRecurringRule,
      fieldTaskProgress: dom.fieldTaskProgress,
      fieldTaskSubtasks: dom.fieldTaskSubtasks,
      taskBreakdown: dom.taskBreakdown,
      taskBreakdownList: dom.taskBreakdownList,
      fieldTaskAssignedTo: dom.fieldTaskAssignedTo,
    };
  }

  function init(dom, options = {}) {
    bindElements(dom);
    onTasksChanged = options.onTasksChanged || null;

    els.fieldTaskCategory.innerHTML = TASK_CATEGORIES.map(
      (c) => `<option value="${c.value}">${c.label}</option>`
    ).join("");

    if (dom.btnAddTask) {
      dom.btnAddTask.addEventListener("click", openAddModal);
    }

    els.fieldTaskRecurring.addEventListener("change", () => {
      toggleRecurringFields(els.fieldTaskRecurring.checked);
    });

    els.btnTaskBreakDown.addEventListener("click", handleBreakDown);
    els.taskModalClose.addEventListener("click", closeModal);
    els.taskModal.addEventListener("click", (e) => {
      if (e.target === els.taskModal) closeModal();
    });
    els.taskForm.addEventListener("submit", handleSave);
    els.btnTaskDelete.addEventListener("click", handleDelete);
  }

  async function createTaskQuick({ title, dueDate, priority, category }) {
    const task = {
      id: crypto.randomUUID(),
      title: title || "New task",
      description: "",
      category: category || "general",
      priority: priority || "medium",
      dueDate: dueDate || "",
      startDate: "",
      estimatedDuration: 45,
      tags: ["intent"],
      isRecurring: false,
      recurringRule: "",
      progress: 0,
      subtasks: [],
      assignedTo: "me",
    };
    await saveTask(task);
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) tasks[idx] = task;
    else tasks.push(task);
    renderTaskCards();
    if (onTasksChanged) onTasksChanged(tasks);
    return task;
  }

  window.LifeAdminTasks = {
    RECURRING_RULES,
    PRIORITIES,
    ASSIGN_LABELS,
    TASK_CATEGORIES,
    init,
    loadTasks,
    getTasks,
    getTasksDueSoon,
    getNextDueDate,
    openAddModal,
    openEditModal,
    renderTaskCards,
    createTasksBulk,
    createTaskQuick,
  };
})();
