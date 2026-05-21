/**
 * Life Admin — Action & Execution Engine v1 (placeholder execution, no external APIs)
 */
(function () {
  const ACTION_TYPES = Object.freeze({
    open_workflow: {
      label: "Open workflow",
      defaultCta: "Start",
      doItMessage: "Creating checklist…",
    },
    open_document: {
      label: "Open document",
      defaultCta: "Open",
      doItMessage: "Opening document…",
    },
    draft_email: {
      label: "Draft email",
      defaultCta: "Draft email",
      doItMessage: "Drafting email…",
    },
    schedule_reminder: {
      label: "Schedule reminder",
      defaultCta: "Schedule",
      doItMessage: "Scheduling reminder…",
    },
    create_task: {
      label: "Create task",
      defaultCta: "Create task",
      doItMessage: "Adding task…",
    },
    open_calendar: {
      label: "Open calendar",
      defaultCta: "Open calendar",
      doItMessage: "Preparing booking…",
    },
  });

  const DIFFICULTY = Object.freeze({
    easy: { label: "Easy", maxMins: 5 },
    medium: { label: "Medium", maxMins: 15 },
    hard: { label: "Involved", maxMins: 999 },
  });

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + "T12:00:00");
    due.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function dueLabel(dateStr) {
    const d = daysUntil(dateStr);
    if (d == null) return "";
    if (d < 0) return `${Math.abs(d)}d overdue`;
    if (d === 0) return "due today";
    if (d === 1) return "due tomorrow";
    if (d <= 7) {
      const wd = new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
      });
      return `due ${wd}`;
    }
    return `due ${new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }

  function difficultyForMinutes(mins) {
    if (mins <= DIFFICULTY.easy.maxMins) return "easy";
    if (mins <= DIFFICULTY.medium.maxMins) return "medium";
    return "hard";
  }

  function makeAction(partial) {
    const type = ACTION_TYPES[partial.actionType] || ACTION_TYPES.create_task;
    const mins = partial.estimatedMinutes ?? 10;
    return {
      id: partial.id || crypto.randomUUID(),
      icon: partial.icon || "⚠",
      title: partial.title,
      estimatedMinutes: mins,
      estimatedLabel: `${mins} min`,
      difficulty: partial.difficulty || difficultyForMinutes(mins),
      nextStep: partial.nextStep || "Review and complete the next step",
      actionType: partial.actionType,
      ctaLabel: partial.ctaLabel || type.defaultCta,
      doItMessage: partial.doItMessage || type.doItMessage,
      sort: partial.sort ?? 100,
      payload: partial.payload || {},
      dueLabel: partial.dueLabel || "",
    };
  }

  function generateActions(ctx) {
    const actions = [];
    const seen = new Set();
    const Access = window.LifeAdminAccess;

    function push(a) {
      if (!a || seen.has(a.id)) return;
      seen.add(a.id);
      actions.push(a);
    }

    const allItems = ctx?.allItems || [];
    const tasks = ctx?.tasks || [];
    const workflows = (ctx?.workflows || []).filter((w) => w.status === "active");
    const vaultDocuments = ctx?.vaultDocuments || [];
    const familyReminders = window.LifeAdminFamily?.getReminders?.() || [];

    for (const item of allItems) {
      if (Access && !Access.canAccessCategory?.(item.category)) continue;
      const days = item.days ?? daysUntil(item.dueDate);
      if (days == null || days > 60) continue;

      if (item.category === "passport") {
        push(
          makeAction({
            id: `act:passport:${item.id}`,
            icon: "⚠",
            title: "Passport renewal",
            estimatedMinutes: 8,
            nextStep: "Check expiry, gather photos, and start the renewal form",
            actionType: "open_workflow",
            ctaLabel: "Start",
            doItMessage: "Creating renewal checklist…",
            sort: days,
            dueLabel: dueLabel(item.dueDate),
            payload: { workflowType: "passport_renewal", reminderId: item.id, category: item.category },
          })
        );
        const passportDoc = vaultDocuments.find((d) =>
          /passport/i.test((d.title || d.name || "") + (d.category || ""))
        );
        if (passportDoc) {
          push(
            makeAction({
              id: `act:vault:passport:${passportDoc.id}`,
              icon: "🛡️",
              title: "Passport document in Vault",
              estimatedMinutes: 2,
              nextStep: "Confirm scan is current before you submit",
              actionType: "open_document",
              ctaLabel: "Open",
              sort: days + 0.5,
              payload: { documentId: passportDoc.id },
            })
          );
        }
      }

      if (item.category === "mot" && days >= 0 && days <= 30) {
        push(
          makeAction({
            id: `act:mot:${item.id}`,
            icon: "⚠",
            title: "Book MOT / garage",
            estimatedMinutes: 5,
            nextStep: "Compare local garages and book a slot",
            actionType: "draft_email",
            ctaLabel: "Find providers",
            doItMessage: "Preparing booking…",
            sort: days,
            dueLabel: dueLabel(item.dueDate),
            payload: {
              template: "mot_booking",
              reminderId: item.id,
              title: item.title,
            },
          })
        );
      }

      if (/school|form|trip/i.test(item.title || "")) {
        const dl = dueLabel(item.dueDate);
        push(
          makeAction({
            id: `act:school:${item.id}`,
            icon: "⚠",
            title: /form/i.test(item.title || "")
              ? `School form${dl ? ` ${dl}` : ""}`
              : item.title,
            estimatedMinutes: 2,
            nextStep: "Complete and return the form before the deadline",
            actionType: "open_workflow",
            ctaLabel: "Open workflow",
            doItMessage: "Opening school trip workflow…",
            sort: Math.max(0, days),
            dueLabel: "",
            payload: { workflowType: "school_trip", reminderId: item.id },
          })
        );
      }

      if (item.category === "bills" && /insurance/i.test(item.title || "")) {
        push(
          makeAction({
            id: `act:insurance:${item.id}`,
            icon: "⚠",
            title: "Renew insurance",
            estimatedMinutes: 12,
            nextStep: "Compare quotes and confirm cover before renewal",
            actionType: "schedule_reminder",
            ctaLabel: "Schedule",
            sort: days + 5,
            dueLabel: dueLabel(item.dueDate),
            payload: { category: "bills", title: item.title, dueDate: item.dueDate },
          })
        );
      }
    }

    for (const t of tasks) {
      const days = daysUntil(t.dueDate);
      if (days == null || days > 14) continue;
      const title = (t.title || "").toLowerCase();

      if (/dentist|doctor|gp|optician|appointment/i.test(title)) {
        push(
          makeAction({
            id: `act:appt:${t.id}`,
            icon: "⚠",
            title: t.title,
            estimatedMinutes: 5,
            nextStep: "Call or book online with your preferred provider",
            actionType: "open_calendar",
            ctaLabel: "Find providers",
            doItMessage: "Preparing booking…",
            sort: days,
            dueLabel: dueLabel(t.dueDate),
            payload: { taskId: t.id, title: t.title, dueDate: t.dueDate },
          })
        );
      } else if (days <= 7) {
        push(
          makeAction({
            id: `act:task:${t.id}`,
            icon: "✓",
            title: t.title,
            estimatedMinutes: Math.min(30, t.estimatedDuration || 15),
            nextStep: "Block time or knock it out in one sitting",
            actionType: "create_task",
            ctaLabel: "Open task",
            sort: days + 20,
            dueLabel: dueLabel(t.dueDate),
            payload: { taskId: t.id, existing: true },
          })
        );
      }
    }

    for (const fr of familyReminders) {
      const days = daysUntil(fr.dueDate);
      if (days == null || days > 14) continue;
      if (!/school|form|trip/i.test(fr.title || "")) continue;
      const dl = dueLabel(fr.dueDate);
      push(
        makeAction({
          id: `act:family:${fr.id}`,
          icon: "⚠",
          title: /form/i.test(fr.title || "") ? `School form${dl ? ` ${dl}` : ""}` : fr.title,
          estimatedMinutes: 2,
          nextStep: "Sign form and arrange payment if needed",
          actionType: "open_workflow",
          ctaLabel: "Open workflow",
          sort: days - 1,
          dueLabel: "",
          payload: { workflowType: "school_trip", familyReminderId: fr.id },
        })
      );
    }

    for (const ev of workflows) {
      const prog = window.LifeAdminWorkflowEngine?.computeProgress?.(ev);
      const next = prog?.nextAction;
      if (!next) continue;
      push(
        makeAction({
          id: `act:wf:${ev.id}`,
          icon: window.LifeAdminLifeEventTemplates?.getWorkflow?.(ev.workflowType)?.icon || "📋",
          title: ev.title,
          estimatedMinutes: Math.min(prog.estMinutes || 30, 45),
          nextStep: next,
          actionType: "open_workflow",
          ctaLabel: "Open workflow",
          doItMessage: "Creating checklist…",
          sort: 15 + (100 - (prog.percent || 0)),
          payload: { workflowId: ev.id, workflowType: ev.workflowType },
        })
      );
    }

    return actions.sort((a, b) => a.sort - b.sort).slice(0, window.LifeAdminOS?.LIST_CAP || 5);
  }

  function draftEmailPlaceholder(action) {
    const p = action.payload || {};
    if (p.template === "mot_booking") {
      return {
        subject: "MOT booking enquiry",
        body: `Hello,\n\nI'd like to book an MOT for my vehicle. Please let me know your next available slots.\n\nThank you`,
      };
    }
    return {
      subject: `Re: ${action.title}`,
      body: `Hello,\n\nI'm writing regarding ${action.title}.\n\n[Your message here]\n\nBest regards`,
    };
  }

  async function runPlaceholderDoIt(action) {
    const delay = 1400 + Math.floor(Math.random() * 600);
    await new Promise((r) => setTimeout(r, delay));
    return action;
  }

  async function executeAction(action, handlers, { assisted = false } = {}) {
    if (!action || !handlers) return;

    const p = action.payload || {};

    switch (action.actionType) {
      case "open_workflow":
        if (p.workflowId) {
          await handlers.onOpenWorkflow?.(p.workflowId);
        } else if (p.workflowType) {
          await handlers.onStartWorkflow?.(p.workflowType);
        }
        break;
      case "open_document":
        await handlers.onOpenDocument?.(p.documentId);
        break;
      case "draft_email": {
        const draft = draftEmailPlaceholder(action);
        await handlers.onDraftEmail?.({ action, draft, assisted });
        break;
      }
      case "schedule_reminder":
        await handlers.onScheduleReminder?.(p.category, {
          title: p.title,
          dueDate: p.dueDate || addDaysIso(7),
          subtitle: assisted ? "Scheduled with Life Admin" : "",
        });
        break;
      case "create_task":
        if (p.existing && p.taskId) {
          await handlers.onOpenTask?.(p.taskId);
        } else {
          await handlers.onCreateTask?.({
            title: p.title || action.title,
            dueDate: p.dueDate || addDaysIso(3),
            priority: "medium",
          });
        }
        break;
      case "open_calendar":
        await handlers.onOpenCalendar?.({
          title: p.title || action.title,
          dueDate: p.dueDate,
          taskId: p.taskId,
        });
        break;
      default:
        break;
    }
  }

  async function executeDoItForMe(action, handlers, onStatus) {
    onStatus?.(action.doItMessage || "Working on it…");
    await runPlaceholderDoIt(action);
    await executeAction(action, handlers, { assisted: true });
    onStatus?.(null);
    return action;
  }

  function addDaysIso(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  window.LifeAdminActionEngine = {
    ACTION_TYPES,
    DIFFICULTY,
    generateActions,
    executeAction,
    executeDoItForMe,
    draftEmailPlaceholder,
  };
})();
