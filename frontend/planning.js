/**
 * Life Admin — Planning & Calendar v1
 */
(function () {
  const TABLE = "life_admin_time_blocks";
  const LS_KEY = "life_admin_time_blocks";
  const FEATURE = () => window.LifeAdminAccess?.FEATURES?.PLANNING_CALENDAR || "planning.calendar";

  const VIEWS = ["day", "week", "month"];
  const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  let timeBlocks = [];
  let els = {};
  let handlers = {};
  let calendarView = "week";
  let focusDate = startOfDay(new Date());
  let useLocalFallback = true;
  let lastPlan = null;

  function getClient() {
    return window.supabaseClient;
  }

  function canUsePlanning() {
    return window.LifeAdminAccess?.canAccess?.(FEATURE()) ?? true;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function isoDate(d) {
    return startOfDay(d).toISOString().slice(0, 10);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function mondayOf(ref) {
    const d = startOfDay(ref);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function escape(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function rowToBlock(row) {
    return {
      id: row.id,
      taskId: row.task_id || null,
      title: row.title || "",
      blockDate: row.block_date,
      startTime: String(row.start_time).slice(0, 8),
      endTime: String(row.end_time).slice(0, 8),
      category: row.category || "general",
      priority: row.priority || "medium",
      source: row.source || "manual",
    };
  }

  function blockToRow(b) {
    return {
      id: b.id,
      task_id: b.taskId || null,
      title: b.title,
      block_date: b.blockDate,
      start_time: b.startTime,
      end_time: b.endTime,
      category: b.category,
      priority: b.priority,
      source: b.source || "manual",
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

  function saveLocal(blocks) {
    localStorage.setItem(LS_KEY, JSON.stringify(blocks));
  }

  async function loadTimeBlocks() {
    const client = getClient();
    if (!client) {
      useLocalFallback = true;
      timeBlocks = loadLocal().map((r) => ({
        id: r.id,
        taskId: r.taskId,
        title: r.title,
        blockDate: r.blockDate,
        startTime: r.startTime,
        endTime: r.endTime,
        category: r.category,
        priority: r.priority,
        source: r.source,
      }));
      return timeBlocks;
    }
    try {
      const { data, error } = await client.from(TABLE).select("*").order("block_date");
      if (error) throw error;
      useLocalFallback = false;
      timeBlocks = (data || []).map(rowToBlock);
      return timeBlocks;
    } catch (err) {
      console.warn("Time blocks: local fallback", err.message);
      useLocalFallback = true;
      timeBlocks = loadLocal();
      return timeBlocks;
    }
  }

  async function persistBlock(block) {
    if (useLocalFallback || !getClient()) {
      const idx = timeBlocks.findIndex((b) => b.id === block.id);
      if (idx >= 0) timeBlocks[idx] = block;
      else timeBlocks.push(block);
      saveLocal(timeBlocks);
      return block;
    }
    const { error } = await getClient().from(TABLE).upsert(blockToRow(block));
    if (error) throw error;
    return block;
  }

  async function deleteBlock(id) {
    if (useLocalFallback || !getClient()) {
      timeBlocks = timeBlocks.filter((b) => b.id !== id);
      saveLocal(timeBlocks);
      return;
    }
    await getClient().from(TABLE).delete().eq("id", id);
    timeBlocks = timeBlocks.filter((b) => b.id !== id);
  }

  function getTimeBlocks() {
    return timeBlocks;
  }

  function aggregateEvents(ctx) {
    const events = [];
    const { allItems = [], tasks = [] } = ctx;

    for (const b of timeBlocks) {
      events.push({
        id: `block:${b.id}`,
        type: "block",
        title: b.title,
        date: b.blockDate,
        startTime: b.startTime,
        endTime: b.endTime,
        category: b.category,
        priority: b.priority,
        icon: "📅",
        block: b,
      });
    }

    for (const item of allItems) {
      if (!item.dueDate || item.days > 90) continue;
      if (timeBlocks.some((b) => b.blockDate === item.dueDate && b.title === item.title)) continue;
      events.push({
        id: `reminder:${item.category}:${item.id}`,
        type: "reminder",
        title: item.title,
        date: item.dueDate,
        allDay: true,
        category: item.category,
        priority: item.urgency === "urgent" ? "high" : "medium",
        icon: item.config?.icon || "🔔",
        payload: { category: item.category, id: item.id },
      });
    }

    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (timeBlocks.some((b) => b.taskId === t.id)) continue;
      events.push({
        id: `task:${t.id}`,
        type: "task",
        title: t.title,
        date: t.dueDate,
        allDay: true,
        category: t.category,
        priority: t.priority,
        icon: "✓",
        task: t,
      });
    }

    const familyEvents = window.LifeAdminPlanningAI?.buildFamilyEvents?.(ctx) || [];
    for (const ev of familyEvents) {
      events.push({
        id: ev.id,
        type: "family",
        title: ev.title,
        date: ev.date,
        allDay: true,
        icon: ev.icon,
        priority: ev.days <= 3 ? "high" : "medium",
      });
    }

    for (const doc of ctx.vaultDocuments || []) {
      if (!doc.expiryDate) continue;
      const days = daysUntil(doc.expiryDate);
      if (days == null || days > 90) continue;
      events.push({
        id: `renewal:${doc.id}`,
        type: "renewal",
        title: `${doc.title} renewal`,
        date: doc.expiryDate,
        allDay: true,
        icon: "📄",
        priority: days <= 14 ? "high" : "medium",
      });
    }

    return events;
  }

  function daysUntil(dateStr) {
    const today = startOfDay(new Date());
    const due = startOfDay(new Date(dateStr + "T12:00:00"));
    return Math.round((due - today) / 86400000);
  }

  function eventsOnDate(events, dateIso) {
    return events.filter((e) => e.date === dateIso);
  }

  function unscheduledTasks(ctx) {
    const tasks = ctx.tasks || [];
    const scheduledTaskIds = new Set(timeBlocks.map((b) => b.taskId).filter(Boolean));
    return tasks.filter((t) => t.progress < 100 && !scheduledTaskIds.has(t.id));
  }

  function renderViewTabs() {
    if (!els.planViewTabs) return;
    els.planViewTabs.querySelectorAll("[data-plan-view]").forEach((btn) => {
      const v = btn.dataset.planView;
      btn.classList.toggle("plan-view-tab--active", v === calendarView);
      btn.setAttribute("aria-pressed", v === calendarView ? "true" : "false");
    });
  }

  function renderNavLabel() {
    if (!els.planNavLabel) return;
    if (calendarView === "day") {
      els.planNavLabel.textContent = focusDate.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } else if (calendarView === "week") {
      const mon = mondayOf(focusDate);
      const sun = addDays(mon, 6);
      els.planNavLabel.textContent = `${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    } else {
      els.planNavLabel.textContent = `${MONTH_NAMES[focusDate.getMonth()]} ${focusDate.getFullYear()}`;
    }
  }

  function renderDayView(events) {
    const iso = isoDate(focusDate);
    const dayEvents = eventsOnDate(events, iso);
    const html = [`<div class="plan-day-grid">`];
    for (const hour of HOURS) {
      const slotId = `${iso}-${hour}`;
      const slotEvents = dayEvents.filter((e) => {
        if (e.allDay) return hour === 9;
        const h = parseInt(e.startTime, 10);
        return h === hour;
      });
      html.push(`<div class="plan-day-row" data-drop-date="${iso}" data-drop-hour="${hour}">
        <span class="plan-day-row__time">${hour}:00</span>
        <div class="plan-day-row__slot plan-drop-slot" data-drop-date="${iso}" data-drop-hour="${hour}">`);
      for (const ev of slotEvents) {
        html.push(eventChip(ev, true));
      }
      html.push(`</div></div>`);
    }
    html.push("</div>");
    els.planCalendar.innerHTML = html.join("");
    bindDropSlots();
    els.planCalendar.querySelectorAll(".plan-event--block").forEach((chip) => {
      chip.addEventListener("click", () => {
        const id = chip.dataset.blockId;
        const block = timeBlocks.find((b) => b.id === id);
        if (block) openBlockModal(block);
      });
    });
  }

  function renderWeekView(events) {
    const mon = mondayOf(focusDate);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(mon, i));

    let html = `<div class="plan-week-grid"><div class="plan-week-head"></div>`;
    days.forEach((d) => {
      const iso = isoDate(d);
      const isToday = iso === isoDate(new Date());
      html += `<div class="plan-week-head__day${isToday ? " plan-week-head__day--today" : ""}">
        <span class="plan-week-head__name">${d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
        <span class="plan-week-head__num">${d.getDate()}</span></div>`;
    });
    html += '</div><div class="plan-week-body">';
    days.forEach((d) => {
      const iso = isoDate(d);
      const dayEv = eventsOnDate(events, iso);
      html += `<div class="plan-week-col plan-drop-slot" data-drop-date="${iso}" data-drop-hour="9">`;
      dayEv.slice(0, 6).forEach((ev) => {
        html += eventChip(ev, false);
      });
      if (dayEv.length > 6) html += `<span class="plan-week-more">+${dayEv.length - 6}</span>`;
      html += "</div>";
    });
    html += "</div></div>";
    els.planCalendar.innerHTML = html;
    bindDropSlots();
  }

  function renderMonthView(events) {
    const y = focusDate.getFullYear();
    const m = focusDate.getMonth();
    const first = new Date(y, m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    let html = `<div class="plan-month-grid">`;
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((n) => {
      html += `<span class="plan-month-dow">${n}</span>`;
    });
    for (let i = 0; i < startPad; i++) html += `<span class="plan-month-cell plan-month-cell--pad"></span>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const iso = isoDate(date);
      const isToday = iso === isoDate(new Date());
      const dayEv = eventsOnDate(events, iso);
      html += `<button type="button" class="plan-month-cell plan-drop-slot${isToday ? " plan-month-cell--today" : ""}" data-drop-date="${iso}" data-drop-hour="10">
        <span class="plan-month-cell__num">${d}</span>`;
      if (dayEv.length) {
        html += `<span class="plan-month-dots">${dayEv.slice(0, 3).map((e) => `<i class="plan-month-dot plan-month-dot--${e.type}"></i>`).join("")}</span>`;
      }
      html += `</button>`;
    }
    html += "</div>";
    els.planCalendar.innerHTML = html;
    bindDropSlots();
    els.planCalendar.querySelectorAll(".plan-month-cell:not(.plan-month-cell--pad)").forEach((cell) => {
      cell.addEventListener("click", (e) => {
        if (e.target.closest(".plan-drop-slot")) {
          focusDate = startOfDay(new Date(cell.dataset.dropDate + "T12:00:00"));
          calendarView = "day";
          renderViewTabs();
          renderPlanning(lastCtx);
        }
      });
    });
  }

  function eventChip(ev, detailed) {
    const cls = `plan-event plan-event--${ev.type} plan-event--pri-${ev.priority || "medium"}`;
    const time =
      !ev.allDay && ev.startTime
        ? `${ev.startTime.slice(0, 5)}${ev.endTime ? `–${ev.endTime.slice(0, 5)}` : ""}`
        : "";
    const blockAttr = ev.block ? ` data-block-id="${ev.block.id}"` : "";
    return `<div class="${cls}${ev.type === "block" ? " plan-event--block" : ""}"${blockAttr} title="${escape(ev.title)}">
      <span class="plan-event__icon">${ev.icon || "•"}</span>
      <span class="plan-event__title">${escape(ev.title)}</span>
      ${detailed && time ? `<span class="plan-event__time">${time}</span>` : ""}
    </div>`;
  }

  function renderUnscheduled(ctx) {
    if (!els.planUnscheduled) return;
    const list = unscheduledTasks(ctx);
    els.planUnscheduled.replaceChildren();
    if (!list.length) {
      els.planUnscheduled.innerHTML = `<li class="plan-unscheduled__empty">All tasks scheduled or no open tasks</li>`;
      return;
    }
    list.forEach((t) => {
      const li = document.createElement("li");
      li.className = "plan-task-drag";
      li.draggable = true;
      li.dataset.taskId = t.id;
      li.dataset.taskTitle = t.title;
      li.dataset.taskCategory = t.category || "general";
      li.dataset.taskPriority = t.priority || "medium";
      li.innerHTML = `<span class="plan-task-drag__icon">✓</span><span>${escape(t.title)}</span>`;
      li.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("application/task-id", t.id);
        e.dataTransfer.setData("application/task-title", t.title);
        e.dataTransfer.setData("application/task-category", t.category || "general");
        e.dataTransfer.setData("application/task-priority", t.priority || "medium");
        e.dataTransfer.effectAllowed = "copy";
      });
      els.planUnscheduled.appendChild(li);
    });
  }

  function bindDropSlots() {
    els.planCalendar?.querySelectorAll(".plan-drop-slot").forEach((slot) => {
      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        slot.classList.add("plan-drop-slot--over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("plan-drop-slot--over"));
      slot.addEventListener("drop", async (e) => {
        e.preventDefault();
        slot.classList.remove("plan-drop-slot--over");
        const taskId = e.dataTransfer.getData("application/task-id");
        const title = e.dataTransfer.getData("application/task-title") || "Task";
        const category = e.dataTransfer.getData("application/task-category") || "general";
        const priority = e.dataTransfer.getData("application/task-priority") || "medium";
        const date = slot.dataset.dropDate;
        const hour = parseInt(slot.dataset.dropHour, 10) || 9;
        const block = {
          id: crypto.randomUUID(),
          taskId: taskId || null,
          title,
          blockDate: date,
          startTime: `${String(hour).padStart(2, "0")}:00:00`,
          endTime: `${String(hour + 1).padStart(2, "0")}:00:00`,
          category,
          priority,
          source: "task_drag",
        };
        await persistBlock(block);
        const idx = timeBlocks.findIndex((b) => b.id === block.id);
        if (idx < 0) timeBlocks.push(block);
        renderPlanning(lastCtx);
        handlers.onPlanningChanged?.();
      });
    });
  }

  function renderFamilyEvents(ctx) {
    if (!els.planFamilyEvents) return;
    const events = window.LifeAdminPlanningAI?.buildFamilyEvents?.(ctx) || [];
    els.planFamilyEvents.replaceChildren();
    events.slice(0, 8).forEach((ev) => {
      const li = document.createElement("li");
      li.className = "plan-family-event";
      const when =
        ev.days === 0 ? "Today" : ev.days === 1 ? "Tomorrow" : ev.days <= 7 ? `In ${ev.days} days` : formatShort(ev.date);
      li.innerHTML = `<span class="plan-family-event__icon">${ev.icon}</span>
        <span class="plan-family-event__body">
          <span class="plan-family-event__title">${escape(ev.title)}</span>
          <span class="plan-family-event__when">${escape(when)}</span>
        </span>`;
      els.planFamilyEvents.appendChild(li);
    });
  }

  function formatShort(dateStr) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function renderAiPlan(plan) {
    if (!els.planAiResult) return;
    if (!plan) {
      els.planAiResult.hidden = true;
      return;
    }
    els.planAiResult.hidden = false;
    if (els.planWorkload) {
      els.planWorkload.hidden = false;
      els.planWorkload.textContent = `${plan.workload.label} week — ~${Math.round(plan.workload.hours)}h · ${plan.workload.taskCount} tasks · ${plan.workload.familyEventCount} family events`;
    }
    if (els.planScheduleList) {
      els.planScheduleList.replaceChildren();
      plan.schedule.forEach((row) => {
        const li = document.createElement("li");
        li.className = "plan-schedule-row";
        li.innerHTML = `<span class="plan-schedule-row__day">${escape(row.day)}</span>
          <span class="plan-schedule-row__summary">${escape(row.summary)}</span>`;
        els.planScheduleList.appendChild(li);
      });
    }
    if (els.planFamilyPriorityList) {
      els.planFamilyPriorityList.replaceChildren();
      (plan.familyPriorities || []).forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${p.icon}</span> <strong>${escape(p.label)}</strong> <span class="plan-meta">${escape(p.meta)}</span>`;
        els.planFamilyPriorityList.appendChild(li);
      });
    }
    if (els.planBlockSuggestions) {
      els.planBlockSuggestions.replaceChildren();
      plan.suggestedBlocks.slice(0, 8).forEach((b) => {
        const li = document.createElement("li");
        li.className = "plan-block-suggestion";
        li.innerHTML = `<span>${escape(b.blockDate)} ${b.startTime.slice(0, 5)}–${b.endTime.slice(0, 5)}</span>
          <span>${escape(b.title)}</span>`;
        els.planBlockSuggestions.appendChild(li);
      });
    }
  }

  let lastCtx = null;

  function renderPlanning(ctx) {
    lastCtx = ctx;
    if (!canUsePlanning()) {
      if (els.planUpgradeCard) els.planUpgradeCard.hidden = false;
      if (els.planContent) els.planContent.hidden = true;
      return;
    }
    if (els.planUpgradeCard) els.planUpgradeCard.hidden = true;
    if (els.planContent) els.planContent.hidden = false;

    const events = aggregateEvents(ctx);
    renderViewTabs();
    renderNavLabel();
    renderUnscheduled(ctx);
    renderFamilyEvents(ctx);
    if (lastPlan) renderAiPlan(lastPlan);

    if (calendarView === "day") renderDayView(events);
    else if (calendarView === "week") renderWeekView(events);
    else renderMonthView(events);
  }

  function openBlockModal(block) {
    const preset = block || null;
    els.fieldBlockId.value = preset?.id || "";
    els.fieldBlockTitle.value = preset?.title || "";
    els.fieldBlockDate.value = preset?.blockDate || isoDate(focusDate);
    els.fieldBlockStart.value = (preset?.startTime || "09:00:00").slice(0, 5);
    els.fieldBlockEnd.value = (preset?.endTime || "10:00:00").slice(0, 5);
    els.fieldBlockCategory.value = preset?.category || "general";
    els.fieldBlockPriority.value = preset?.priority || "medium";
    els.btnBlockDelete.hidden = !preset?.id;
    els.timeBlockModal.showModal();
  }

  function readBlockForm() {
    return {
      id: els.fieldBlockId.value || crypto.randomUUID(),
      taskId: null,
      title: els.fieldBlockTitle.value.trim(),
      blockDate: els.fieldBlockDate.value,
      startTime: `${els.fieldBlockStart.value}:00`,
      endTime: `${els.fieldBlockEnd.value}:00`,
      category: els.fieldBlockCategory.value,
      priority: els.fieldBlockPriority.value,
      source: "manual",
    };
  }

  async function applyAiPlan(ctx) {
    const plan = window.LifeAdminPlanningAI.generateWeekPlan(ctx);
    lastPlan = plan;
    for (const sb of plan.suggestedBlocks) {
      const block = { id: crypto.randomUUID(), taskId: sb.taskId || null, ...sb };
      await persistBlock(block);
      if (!timeBlocks.find((b) => b.id === block.id)) timeBlocks.push(block);
    }
    renderAiPlan(plan);
    renderPlanning(ctx);
    handlers.onPlanningChanged?.();
  }

  async function init(dom, h = {}) {
    els = { ...dom };
    handlers = h;
    if (els.planUpgradeText) {
      els.planUpgradeText.textContent =
        window.LifeAdminAccess?.getUpgradeMessage?.(FEATURE()) ||
        "Upgrade to plan your week with calendar and time blocks.";
    }

    els.planViewTabs?.querySelectorAll("[data-plan-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        calendarView = btn.dataset.planView;
        renderViewTabs();
        if (lastCtx) renderPlanning(lastCtx);
      });
    });

    els.planNavPrev?.addEventListener("click", () => {
      if (calendarView === "day") focusDate = addDays(focusDate, -1);
      else if (calendarView === "week") focusDate = addDays(focusDate, -7);
      else focusDate = new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1);
      if (lastCtx) renderPlanning(lastCtx);
    });
    els.planNavNext?.addEventListener("click", () => {
      if (calendarView === "day") focusDate = addDays(focusDate, 1);
      else if (calendarView === "week") focusDate = addDays(focusDate, 7);
      else focusDate = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1);
      if (lastCtx) renderPlanning(lastCtx);
    });
    els.planNavToday?.addEventListener("click", () => {
      focusDate = startOfDay(new Date());
      if (lastCtx) renderPlanning(lastCtx);
    });

    els.btnPlanWeek?.addEventListener("click", () => {
      if (lastCtx) applyAiPlan(lastCtx);
    });
    els.btnAddTimeBlock?.addEventListener("click", () => openBlockModal(null));

    els.timeBlockForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const block = readBlockForm();
      if (!block.title) return;
      await persistBlock(block);
      const idx = timeBlocks.findIndex((b) => b.id === block.id);
      if (idx >= 0) timeBlocks[idx] = block;
      else timeBlocks.push(block);
      els.timeBlockModal.close();
      renderPlanning(lastCtx);
      handlers.onPlanningChanged?.();
    });
    els.timeBlockClose?.addEventListener("click", () => els.timeBlockModal?.close());
    els.btnBlockDelete?.addEventListener("click", async () => {
      const id = els.fieldBlockId.value;
      if (!id || !confirm("Delete this time block?")) return;
      await deleteBlock(id);
      els.timeBlockModal.close();
      renderPlanning(lastCtx);
      handlers.onPlanningChanged?.();
    });

    await loadTimeBlocks();
  }

  window.LifeAdminPlanning = {
    init,
    loadTimeBlocks,
    getTimeBlocks,
    aggregateEvents,
    renderPlanning,
    canUsePlanning,
    openBlockModal,
    buildDailyTimeline: (ctx) =>
      window.LifeAdminPlanningAI.buildDailyTimeline(ctx, timeBlocks),
  };
})();
