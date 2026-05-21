/**
 * Life Admin — Life Event Workflows v1
 */
(function () {
  const TABLE = "life_admin_life_events";
  const LS_KEY = "life_admin_life_events";
  const FEATURE = () => window.LifeAdminAccess?.FEATURES?.LIFE_EVENTS || "life.events";

  let events = [];
  let els = {};
  let handlers = {};
  let activeEventId = null;
  let useLocalFallback = true;

  function getClient() {
    return window.supabaseClient;
  }

  function canUseLifeEvents() {
    return window.LifeAdminAccess?.canAccess?.(FEATURE()) ?? true;
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function rowToEvent(row) {
    return {
      id: row.id,
      workflowType: row.workflow_type,
      title: row.title,
      targetDate: row.target_date || "",
      status: row.status || "active",
      items: Array.isArray(row.items) ? row.items : [],
      createdAt: row.created_at,
    };
  }

  function eventToRow(ev) {
    return {
      id: ev.id,
      workflow_type: ev.workflowType,
      title: ev.title,
      target_date: ev.targetDate || null,
      status: ev.status,
      items: ev.items,
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

  async function loadEvents() {
    const client = getClient();
    if (!client) {
      useLocalFallback = true;
      events = loadLocal();
      return events;
    }
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .neq("status", "archived")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      useLocalFallback = false;
      events = (data || []).map(rowToEvent);
      return events;
    } catch (err) {
      console.warn("Life events: local fallback", err.message);
      useLocalFallback = true;
      events = loadLocal();
      return events;
    }
  }

  async function persistWorkflowInstance(ev) {
    return persistEvent(ev);
  }

  async function persistEvent(ev) {
    if (useLocalFallback || !getClient()) {
      const idx = events.findIndex((e) => e.id === ev.id);
      if (idx >= 0) events[idx] = ev;
      else events.unshift(ev);
      saveLocal(events);
      return ev;
    }
    const { error } = await getClient().from(TABLE).upsert(eventToRow(ev));
    if (error) throw error;
    return ev;
  }

  async function deleteEvent(id) {
    if (useLocalFallback || !getClient()) {
      events = events.filter((e) => e.id !== id);
      saveLocal(events);
      return;
    }
    await getClient().from(TABLE).delete().eq("id", id);
    events = events.filter((e) => e.id !== id);
  }

  function getEvents() {
    return events;
  }

  function getActiveEvent() {
    return events.find((e) => e.id === activeEventId) || null;
  }

  function computeProgress(ev) {
    const actionable = ev.items.filter((i) =>
      ["checklist", "task"].includes(i.kind)
    );
    if (!actionable.length) {
      return { percent: 0, remaining: 0, estMinutes: 0, total: 0, done: 0 };
    }
    const done = actionable.filter((i) => i.done).length;
    const remaining = actionable.length - done;
    const estMinutes = actionable
      .filter((i) => !i.done)
      .reduce((s, i) => s + (i.estMinutes || 30), 0);
    const percent = Math.round((done / actionable.length) * 100);
    return {
      percent,
      remaining,
      estMinutes,
      total: actionable.length,
      done,
    };
  }

  function formatEstTime(mins) {
    if (mins < 60) return `~${mins} min`;
    const h = Math.round((mins / 60) * 10) / 10;
    return `~${h}h`;
  }

  function itemsByKind(ev, kind) {
    return ev.items.filter((i) => i.kind === kind);
  }

  async function startWorkflow(workflowType, targetDate) {
    const engine = window.LifeAdminWorkflowEngine;
    const detection = {
      blueprintId: workflowType,
      text: "",
      confidence: "high",
      targetDate: targetDate || undefined,
    };
    const plan = engine?.buildPlan?.(detection);
    if (plan && handlers.onActivateWorkflow) {
      const ev = await handlers.onActivateWorkflow(plan, { silent: true });
      if (ev) {
        activeEventId = ev.id;
        return ev;
      }
    }

    const template =
      window.LifeAdminLifeEventTemplates.getWorkflow(workflowType) ||
      window.LifeAdminWorkflowDefinitions?.getBlueprint?.(workflowType);
    if (!template) return null;

    const target = targetDate || defaultTargetDate(template);
    const items = engine?.buildItems
      ? engine.buildItems(workflowType, target)
      : window.LifeAdminLifeEventTemplates.buildItemsFromTemplate(template, target);

    const ev = {
      id: crypto.randomUUID(),
      workflowType,
      title: template.title,
      targetDate: target,
      status: "active",
      items,
      createdAt: new Date().toISOString(),
    };

    await persistEvent(ev);
    activeEventId = ev.id;
    return ev;
  }

  function openWorkflowById(id) {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    activeEventId = id;
    handlers.onNavigate?.("life-events");
    renderDetail(ev);
  }

  function defaultTargetDate(template) {
    const d = new Date();
    d.setDate(d.getDate() + (template.defaultTargetDays || 30));
    return d.toISOString().slice(0, 10);
  }

  async function toggleItem(eventId, itemKey, done) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const item = ev.items.find((i) => i.key === itemKey);
    if (item) item.done = done;
    if (done && computeProgress(ev).percent >= 100) ev.status = "completed";
    await persistEvent(ev);
    renderLifeEvents();
  }

  async function pushTasksToApp(ev) {
    const client = getClient();
    if (!client || !window.LifeAdminTasks) {
      alert("Connect Supabase to sync tasks.");
      return 0;
    }

    const taskItems = ev.items.filter((i) => i.kind === "task" && !i.taskCreated);
    const created = [];
    for (const t of taskItems) {
      const task = {
        id: crypto.randomUUID(),
        title: t.title,
        description: `${ev.title} workflow`,
        category: t.category || "general",
        priority: t.priority || "medium",
        dueDate: t.dueDate || ev.targetDate,
        startDate: "",
        estimatedDuration: t.estMinutes || 45,
        tags: ["life-event", ev.workflowType],
        isRecurring: false,
        recurringRule: "",
        progress: 0,
        subtasks: [],
        assignedTo: "me",
      };
      try {
        await client.from("life_admin_tasks").upsert({
          id: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          due_date: task.dueDate,
          tags: task.tags,
          progress: 0,
          subtasks: [],
          assigned_to: "me",
          updated_at: new Date().toISOString(),
        });
        t.taskCreated = true;
        created.push(task);
      } catch (err) {
        console.warn("Task create failed:", err.message);
      }
    }

    if (created.length) {
      await window.LifeAdminTasks.loadTasks();
      handlers.onWorkflowChanged?.();
    }
    await persistEvent(ev);
    return created.length;
  }

  async function pushRemindersToApp(ev) {
    const client = getClient();
    if (!client || !handlers.onCreateReminder) return 0;

    let count = 0;
    for (const r of ev.items.filter((i) => i.kind === "reminder" && !i.reminderCreated)) {
      if (!r.reminderCategory) continue;
      try {
        await handlers.onCreateReminder(r.reminderCategory, {
          id: crypto.randomUUID(),
          title: r.title,
          subtitle: ev.title,
          dueDate: r.dueDate || ev.targetDate,
          notes: `From ${ev.title} workflow`,
        });
        r.reminderCreated = true;
        count++;
      } catch (err) {
        console.warn("Reminder create failed:", err.message);
      }
    }
    if (count) await persistEvent(ev);
    return count;
  }

  function renderPicker() {
    if (!els.lifeEventsPicker) return;
    els.lifeEventsPicker.hidden = false;
    if (els.lifeEventsDetail) els.lifeEventsDetail.hidden = true;

    if (els.lifeEventsActiveList) {
      els.lifeEventsActiveList.replaceChildren();
      const active = events.filter((e) => e.status === "active");
      if (!active.length) {
        els.lifeEventsActiveList.innerHTML = `<li class="le-empty">No active workflows yet.</li>`;
      } else {
        active.forEach((ev) => {
          const prog = computeProgress(ev);
          const li = document.createElement("li");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "le-active-row";
          const tmpl = window.LifeAdminLifeEventTemplates.getWorkflow(ev.workflowType);
          btn.innerHTML = `
            <span class="le-active-row__icon">${tmpl?.icon || "📋"}</span>
            <span class="le-active-row__body">
              <span class="le-active-row__title">${escape(ev.title)}</span>
              <span class="le-active-row__meta">${prog.percent}% · ${prog.remaining} tasks left</span>
            </span>
            <span class="le-active-row__chev">›</span>`;
          btn.addEventListener("click", () => {
            activeEventId = ev.id;
            renderDetail(ev);
          });
          li.appendChild(btn);
          els.lifeEventsActiveList.appendChild(li);
        });
      }
    }

    if (els.lifeEventsWorkflowGrid) {
      els.lifeEventsWorkflowGrid.replaceChildren();
      const picker = [
        ...window.LifeAdminLifeEventTemplates.listWorkflows(),
        ...["passport_renewal", "buy_car", "school_trip"].map((id) =>
          window.LifeAdminWorkflowDefinitions.getBlueprint(id)
        ),
      ].filter(Boolean);
      picker.forEach((wf) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "le-workflow-card";
        card.innerHTML = `
          <span class="le-workflow-card__icon">${wf.icon}</span>
          <span class="le-workflow-card__title">${escape(wf.title)}</span>
          <span class="le-workflow-card__desc">${escape(wf.description)}</span>`;
        card.addEventListener("click", () => openStartModal(wf.id));
        els.lifeEventsWorkflowGrid.appendChild(card);
      });
    }
  }

  function getWorkflowMeta(workflowType) {
    return (
      window.LifeAdminLifeEventTemplates?.getWorkflow?.(workflowType) ||
      window.LifeAdminWorkflowDefinitions?.getBlueprint?.(workflowType)
    );
  }

  function openStartModal(workflowType) {
    const tmpl = getWorkflowMeta(workflowType);
    if (!tmpl || !els.startWorkflowModal) return;
    els.startWorkflowModal.dataset.workflowType = workflowType;
    els.startWorkflowTitle.textContent = `Start: ${tmpl.title}`;
    els.fieldWorkflowTarget.value = defaultTargetDate(tmpl);
    els.startWorkflowModal.showModal();
  }

  function renderDetail(ev) {
    if (!els.lifeEventsDetail) return;
    els.lifeEventsPicker.hidden = true;
    els.lifeEventsDetail.hidden = false;

    const tmpl = getWorkflowMeta(ev.workflowType);
    const prog =
      window.LifeAdminWorkflowEngine?.computeProgress?.(ev) || computeProgress(ev);

    if (els.leDetailTitle) els.leDetailTitle.textContent = ev.title;
    if (els.leDetailIcon) els.leDetailIcon.textContent = tmpl?.icon || "📋";
    if (els.leProgressBar) els.leProgressBar.style.width = `${prog.percent}%`;
    if (els.leProgressPct) els.leProgressPct.textContent = `${prog.percent}% complete`;
    if (els.leProgressMeta) {
      els.leProgressMeta.textContent = `${prog.remaining} tasks remaining · ${formatEstTime(prog.estMinutes)} estimated`;
    }
    if (els.leTargetDate) {
      els.leTargetDate.textContent = ev.targetDate
        ? `Target: ${new Date(ev.targetDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
        : "";
    }

    renderChecklist(ev);
    renderTimeline(ev);
    renderDocuments(ev);
    renderAiHints(ev);

    if (els.leTaskCount) {
      const tasks = itemsByKind(ev, "task");
      els.leTaskCount.textContent = `${tasks.filter((t) => !t.done).length} suggested tasks`;
    }
  }

  function renderChecklist(ev) {
    if (!els.leChecklist) return;
    els.leChecklist.replaceChildren();
    itemsByKind(ev, "checklist").forEach((item) => {
      const li = document.createElement("li");
      li.className = `le-check-item${item.done ? " le-check-item--done" : ""}`;
      const label = document.createElement("label");
      label.className = "le-check-label";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.done;
      cb.addEventListener("change", () => toggleItem(ev.id, item.key, cb.checked));
      label.appendChild(cb);
      label.appendChild(document.createTextNode(` ${item.title}`));
      li.appendChild(label);
      if (item.dueDate) {
        const meta = document.createElement("span");
        meta.className = "le-check-meta";
        meta.textContent = formatDue(item.dueDate);
        li.appendChild(meta);
      }
      els.leChecklist.appendChild(li);
    });
  }

  function renderTimeline(ev) {
    if (!els.leTimeline) return;
    els.leTimeline.replaceChildren();
    itemsByKind(ev, "timeline").forEach((item) => {
      const li = document.createElement("li");
      li.className = "le-timeline-item";
      li.innerHTML = `<span class="le-timeline-item__dot"></span>
        <span class="le-timeline-item__body">
          <span class="le-timeline-item__title">${escape(item.title)}</span>
          <span class="le-timeline-item__date">${formatDue(item.dueDate)}</span>
        </span>`;
      els.leTimeline.appendChild(li);
    });
  }

  function renderDocuments(ev) {
    if (!els.leDocuments) return;
    els.leDocuments.replaceChildren();
    itemsByKind(ev, "document").forEach((doc) => {
      const li = document.createElement("li");
      li.className = "le-doc-item";
      li.innerHTML = `<span>📄</span><span>${escape(doc.title)}</span>${doc.hint ? `<span class="le-doc-hint">${escape(doc.hint)}</span>` : ""}`;
      els.leDocuments.appendChild(li);
    });
  }

  function renderAiHints(ev) {
    if (!els.leAiHints) return;
    const hints = window.LifeAdminLifeEventsAI.getForgettingHints(ev.workflowType, ev.items);
    els.leAiHints.replaceChildren();
    hints.forEach((h) => {
      const li = document.createElement("li");
      li.className = "le-ai-hint";
      li.innerHTML = `<span class="le-ai-hint__text">${escape(h.text)}</span>
        ${h.sub ? `<span class="le-ai-hint__sub">${escape(h.sub)}</span>` : ""}`;
      els.leAiHints.appendChild(li);
    });
  }

  function formatDue(dateStr) {
    if (!dateStr) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + "T12:00:00");
    due.setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 0) return `${Math.abs(days)}d ago`;
    return due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function renderLifeEvents() {
    if (!canUseLifeEvents()) {
      if (els.lifeEventsUpgrade) els.lifeEventsUpgrade.hidden = false;
      if (els.lifeEventsMain) els.lifeEventsMain.hidden = true;
      return;
    }
    if (els.lifeEventsUpgrade) els.lifeEventsUpgrade.hidden = true;
    if (els.lifeEventsMain) els.lifeEventsMain.hidden = false;

    if (activeEventId && events.find((e) => e.id === activeEventId)) {
      renderDetail(getActiveEvent());
    } else {
      activeEventId = null;
      renderPicker();
    }
  }

  async function init(dom, h = {}) {
    els = { ...dom };
    handlers = h;
    if (els.lifeEventsUpgradeText) {
      els.lifeEventsUpgradeText.textContent =
        window.LifeAdminAccess?.getUpgradeMessage?.(FEATURE()) ||
        "Upgrade to unlock guided life event workflows.";
    }

    els.leBackBtn?.addEventListener("click", () => {
      activeEventId = null;
      renderPicker();
    });

    els.startWorkflowForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const type = els.startWorkflowModal?.dataset.workflowType;
      const date = els.fieldWorkflowTarget?.value;
      if (!type) return;
      await startWorkflow(type, date);
      els.startWorkflowModal?.close();
      renderDetail(getActiveEvent());
    });
    els.startWorkflowClose?.addEventListener("click", () => els.startWorkflowModal?.close());

    els.btnSyncTasks?.addEventListener("click", async () => {
      const ev = getActiveEvent();
      if (!ev) return;
      const n = await pushTasksToApp(ev);
      alert(n ? `Added ${n} task${n === 1 ? "" : "s"} to your task list.` : "No new tasks to add.");
      renderDetail(ev);
    });

    els.btnSyncReminders?.addEventListener("click", async () => {
      const ev = getActiveEvent();
      if (!ev) return;
      const n = await pushRemindersToApp(ev);
      alert(n ? `Created ${n} reminder${n === 1 ? "" : "s"}.` : "No reminders to sync.");
      renderDetail(ev);
    });

    els.btnArchiveWorkflow?.addEventListener("click", async () => {
      const ev = getActiveEvent();
      if (!ev || !confirm("Archive this workflow?")) return;
      ev.status = "archived";
      await persistEvent(ev);
      events = events.filter((e) => e.id !== ev.id);
      activeEventId = null;
      renderPicker();
    });

    await loadEvents();
  }

  window.LifeAdminLifeEvents = {
    init,
    loadEvents,
    getEvents,
    renderLifeEvents,
    canUseLifeEvents,
    startWorkflow,
    persistWorkflowInstance,
    openWorkflowById,
    computeProgress,
  };
})();
