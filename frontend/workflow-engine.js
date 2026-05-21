/**
 * Life Admin — Workflow Engine v1 (intent → plan → auto-create)
 */
(function () {
  const LIFE_IDS = window.LifeAdminWorkflowDefinitions?.LIFE_EVENT_IDS || [];

  const PATTERNS = [
    { re: /\b(moving house|move house|we'?re moving|new home|house move)\b/i, id: "moving_house" },
    { re: /\b(new job|starting (a )?job|job offer|first day at)\b/i, id: "new_job" },
    { re: /\b(plan (our |a )?holiday|holiday planning|going on holiday|vacation)\b/i, id: "holiday_planning" },
    { re: /\b(starting uni|university|going to uni|freshers)\b/i, id: "starting_university" },
    { re: /\b(pregnant|pregnancy|expecting|baby due|maternity)\b/i, id: "pregnancy" },
    { re: /\b(starting (a )?business|new business|register (a )?company)\b/i, id: "starting_business" },
    { re: /\b(buy(ing)? (a )?car|new car|purchase (a )?car)\b/i, id: "buy_car" },
    { re: /\b(passport|renew passport|passport renew)\b/i, id: "passport_renewal" },
    { re: /\b(school trip|school form|parents evening)\b/i, id: "school_trip" },
    { re: /\b([A-Z][a-z]+)\s+has\s+a\s+school\b/i, id: "school_trip" },
    { re: /\b(dentist|doctor|gp|optician|book (a )?dentist)\b/i, id: "dentist_appointment" },
  ];

  const EXAMPLE_CHIPS = [
    "Renew my passport",
    "We're moving house",
    "Theo has a school trip",
    "Plan our holiday",
    "Book dentist",
    "Buy a car",
    "I'm starting a business",
  ];

  function normalize(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function extractPersonName(text) {
    const m = text.match(/\b([A-Z][a-z]+)\s+has\b/) || text.match(/\bfor\s+([A-Z][a-z]+)\b/);
    return m ? m[1] : null;
  }

  function getBlueprint(id) {
    if (LIFE_IDS.includes(id)) {
      return window.LifeAdminLifeEventTemplates?.getWorkflow?.(id);
    }
    return window.LifeAdminWorkflowDefinitions?.getBlueprint?.(id);
  }

  function buildItems(blueprintId, targetDate) {
    if (LIFE_IDS.includes(blueprintId)) {
      const t = window.LifeAdminLifeEventTemplates.getWorkflow(blueprintId);
      return window.LifeAdminLifeEventTemplates.buildItemsFromTemplate(t, targetDate);
    }
    const def = window.LifeAdminWorkflowDefinitions.getBlueprint(blueprintId);
    return window.LifeAdminWorkflowDefinitions.flattenBlueprint(def, targetDate);
  }

  function detectIntent(raw) {
    const text = normalize(raw);
    if (!text) return null;

    for (const p of PATTERNS) {
      if (p.re.test(text)) {
        const bp = getBlueprint(p.id);
        if (!bp) continue;
        return {
          text,
          blueprintId: p.id,
          label: bp.title,
          icon: bp.icon,
          confidence: "high",
          personName: extractPersonName(text),
        };
      }
    }

    return {
      text,
      blueprintId: "generic",
      label: "Quick task",
      icon: "✓",
      confidence: "low",
      personName: null,
    };
  }

  function buildPlan(detection) {
    if (!detection) return null;

    if (detection.blueprintId === "generic") {
      const genericPlan = {
        detection,
        blueprintId: "generic",
        title: detection.text,
        icon: "✓",
        targetDate: addDaysIso(7),
        items: [
          {
            key: "generic_task",
            title: detection.text,
            kind: "task",
            dueDate: addDaysIso(7),
            estMinutes: 30,
            priority: "medium",
            category: "general",
            done: false,
          },
        ],
        tasks: [{ title: detection.text, dueDate: addDaysIso(7), priority: "medium", category: "general" }],
        reminders: [],
        calendarBlocks: [],
        aiSuggestions: [{ text: "Ask AI Chief of Staff for a tailored checklist", sub: "Open AI tab for more ideas" }],
        forgetting: [],
        effortLabel: "light",
        timelineLabel: "This week",
        contextNotes: [],
      };
      return (
        window.LifeAdminContextEngine?.personalizePlan?.(
          genericPlan,
          null,
          detection.text
        ) || genericPlan
      );
    }

    const bp = getBlueprint(detection.blueprintId);
    const targetDate =
      detection.targetDate ||
      window.LifeAdminWorkflowDefinitions?.defaultTarget?.(bp.defaultTargetDays) ||
      addDaysIso(bp.defaultTargetDays || 30);

    let items = buildItems(detection.blueprintId, targetDate);

    let familyReminders = [];

    if (detection.personName && detection.blueprintId === "school_trip") {
      items = items.map((i) => {
        if (i.kind === "checklist" && i.key === "form") {
          return { ...i, title: `${detection.personName} — permission form` };
        }
        return i;
      });
      familyReminders = [
        {
          title: `${detection.personName} — school trip`,
          dueDate: offsetFrom(targetDate, -7),
          itemKey: "family_rem",
        },
      ];
    }

    if (detection.blueprintId === "passport_renewal" && /\brenew\b/i.test(detection.text)) {
      const upload = items.find((i) => i.key === "upload_docs");
      if (upload) upload.title = "Upload supporting documents";
    }

    const tasks = items
      .filter((i) => i.kind === "task")
      .map((i) => ({
        title: i.title,
        dueDate: i.dueDate,
        priority: i.priority || "medium",
        category: i.category || "general",
        estMinutes: i.estMinutes,
        itemKey: i.key,
      }));

    const reminders = items
      .filter((i) => i.kind === "reminder" && i.reminderCategory)
      .map((i) => ({
        title: i.title,
        dueDate: i.dueDate,
        category: i.reminderCategory,
        itemKey: i.key,
      }));

    const familyFromItems = items
      .filter((i) => i.kind === "family_reminder")
      .map((i) => ({ title: i.title, dueDate: i.dueDate, itemKey: i.key }));
    familyReminders = familyReminders.concat(familyFromItems);

    const def = window.LifeAdminWorkflowDefinitions?.getBlueprint?.(detection.blueprintId);
    const calendarBlocks = (def?.calendarBlocks || []).map((b) => ({
      ...b,
      blockDate: offsetFrom(targetDate, b.dueOffsetDays),
    }));

    const timelineItems = items.filter((i) => i.kind === "timeline");
    const timelineLabel = formatTimelineLabel(targetDate, timelineItems);

    const forgetting = window.LifeAdminLifeEventsAI?.getForgettingHints?.(
      detection.blueprintId,
      items
    ) || [];

    const aiSuggestions = forgetting.slice(0, 3).map((h) => ({
      text: h.text,
      sub: h.sub || "Suggested follow-up",
    }));

    const basePlan = {
      detection,
      blueprintId: detection.blueprintId,
      title: bp.title,
      icon: bp.icon,
      description: bp.description,
      targetDate,
      items,
      tasks,
      reminders,
      familyReminders,
      calendarBlocks,
      aiSuggestions,
      forgetting,
      effortLabel: bp.effortLabel || "moderate",
      timelineLabel,
    };

    return (
      window.LifeAdminContextEngine?.personalizePlan?.(
        basePlan,
        null,
        detection.text
      ) || basePlan
    );
  }

  function computeProgress(ev) {
    const actionable = (ev.items || []).filter((i) =>
      ["checklist", "task"].includes(i.kind)
    );
    if (!actionable.length) {
      return {
        percent: 0,
        remaining: 0,
        estMinutes: 0,
        total: 0,
        done: 0,
        nextAction: "Review workflow steps",
      };
    }
    const done = actionable.filter((i) => i.done).length;
    const remaining = actionable.length - done;
    const estMinutes = actionable
      .filter((i) => !i.done)
      .reduce((s, i) => s + (i.estMinutes || 30), 0);
    const percent = Math.round((done / actionable.length) * 100);
    const next = actionable.find((i) => !i.done);
    return {
      percent,
      remaining,
      estMinutes,
      total: actionable.length,
      done,
      nextAction: next?.title || "All done — review timeline",
    };
  }

  function formatEstTime(mins) {
    if (mins < 60) return `~${mins} min`;
    const h = Math.round((mins / 60) * 10) / 10;
    return `~${h}h`;
  }

  function effortDisplay(label, estMinutes) {
    const map = {
      light: "Light effort",
      moderate: "Moderate effort",
      significant: "Significant effort",
      "long-term": "Long-term project",
    };
    const base = map[label] || "Estimated effort";
    return estMinutes ? `${base} · ${formatEstTime(estMinutes)} left` : base;
  }

  function buildCard(ev) {
    const bp = getBlueprint(ev.workflowType);
    const prog = computeProgress(ev);
    const timelineItems = (ev.items || []).filter((i) => i.kind === "timeline");
    return {
      id: ev.id,
      workflowType: ev.workflowType,
      title: ev.title,
      icon: bp?.icon || "📋",
      percent: prog.percent,
      nextAction: prog.nextAction,
      effort: effortDisplay(bp?.effortLabel, prog.estMinutes),
      timeline: formatTimelineLabel(ev.targetDate, timelineItems),
      targetDate: ev.targetDate,
      status: ev.status,
    };
  }

  function formatTimelineLabel(targetDate, timelineItems) {
    if (!targetDate) return "Flexible timeline";
    const d = new Date(targetDate + "T12:00:00");
    const opts = { day: "numeric", month: "short", year: "numeric" };
    const main = d.toLocaleDateString(undefined, opts);
    const next = (timelineItems || [])
      .filter((i) => !i.done)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
    if (next?.title) return `${main} · Next: ${next.title}`;
    return `Target: ${main}`;
  }

  function addDaysIso(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function offsetFrom(baseIso, offsetDays) {
    const d = new Date(baseIso + "T12:00:00");
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.toISOString().slice(0, 10);
  }

  async function activatePlan(plan, handlers = {}) {
    if (!plan || plan.blueprintId === "generic") {
      if (plan?.tasks?.[0] && handlers.onAddTask) {
        await handlers.onAddTask(plan.tasks[0]);
      }
      return null;
    }

    const ev = {
      id: crypto.randomUUID(),
      workflowType: plan.blueprintId,
      title: plan.title,
      targetDate: plan.targetDate,
      status: "active",
      items: plan.items.map((i) => ({ ...i, taskCreated: false, reminderCreated: false })),
      createdAt: new Date().toISOString(),
    };

    await window.LifeAdminLifeEvents?.persistWorkflowInstance?.(ev);

    let created = { tasks: 0, reminders: 0, blocks: 0, family: 0 };

    for (const t of plan.tasks || []) {
      if (handlers.onAddTask) {
        try {
          await handlers.onAddTask({
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            category: t.category,
            tags: ["workflow", plan.blueprintId],
          });
          const item = ev.items.find((i) => i.key === t.itemKey);
          if (item) item.taskCreated = true;
          created.tasks++;
        } catch (e) {
          console.warn("Workflow task:", e.message);
        }
      }
    }

    for (const r of plan.reminders || []) {
      if (handlers.onAddReminder && r.category) {
        try {
          await handlers.onAddReminder(r.category, {
            title: r.title,
            dueDate: r.dueDate,
            subtitle: plan.title,
          });
          const item = ev.items.find((i) => i.key === r.itemKey);
          if (item) item.reminderCreated = true;
          created.reminders++;
        } catch (e) {
          console.warn("Workflow reminder:", e.message);
        }
      }
    }

    for (const fr of plan.familyReminders || []) {
      if (handlers.onAddFamilyReminder) {
        try {
          await handlers.onAddFamilyReminder(fr);
          created.family++;
        } catch (e) {
          console.warn("Workflow family reminder:", e.message);
        }
      }
    }

    for (const b of plan.calendarBlocks || []) {
      if (handlers.onAddCalendarBlock) {
        try {
          await handlers.onAddCalendarBlock({
            title: b.title,
            dueDate: b.blockDate,
            startTime: b.startTime,
            endTime: b.endTime,
            category: b.category,
          });
          created.blocks++;
        } catch (e) {
          console.warn("Workflow calendar:", e.message);
        }
      }
    }

    await window.LifeAdminLifeEvents?.persistWorkflowInstance?.(ev);
    handlers.onWorkflowActivated?.(ev, created, plan);
    return ev;
  }

  /** Back-compat for intent-engine.js */
  function parseIntent(raw) {
    const detection = detectIntent(raw);
    if (!detection) return null;
    const plan = buildPlan(detection);
    if (!plan) return null;

    const actions = [
      {
        id: "activate",
        type: "activate_workflow",
        label: `Set up ${plan.title}`,
        plan,
      },
      {
        id: "preview",
        type: "preview_workflow",
        label: "Preview plan",
        plan,
      },
    ];

    if (detection.blueprintId === "generic") {
      return {
        text: detection.text,
        summary: "I'll add this as a task — or set up a full workflow",
        icon: "✓",
        confidence: "low",
        actions: [
          { id: "task", type: "task", label: "Create task", title: detection.text, dueDate: addDaysIso(7) },
          { id: "brain", type: "brain_dump", label: "Brain dump multiple items" },
        ],
        primary: null,
        plan,
        detection,
      };
    }

    const taskCount = (plan.tasks?.length || 0) + (plan.items?.filter((i) => i.kind === "checklist").length || 0);
    const remCount = plan.reminders?.length || 0;

    const baseSummary = `I'll set up ${plan.title} — ${taskCount} steps, ${remCount} reminders, timeline & suggestions`;

    return {
      text: detection.text,
      summary: plan.summary || baseSummary,
      icon: plan.icon,
      confidence: detection.confidence,
      actions,
      primary: actions[0],
      plan,
      detection,
    };
  }

  window.LifeAdminWorkflowEngine = {
    detectIntent,
    buildPlan,
    buildItems,
    activatePlan,
    buildCard,
    computeProgress,
    parseIntent,
    EXAMPLE_CHIPS,
    formatEstTime,
    effortDisplay,
  };
})();
