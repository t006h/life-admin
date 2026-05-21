/**
 * Life Admin — Daily Briefing (placeholder AI insights + brain dump)
 */
(function () {
  const MAX_PRIORITIES = 5;
  const MAX_INSIGHTS = 3;

  const CATEGORY_ICONS = {
    mot: "⚠",
    passport: "🛂",
    licence: "🪪",
    subscriptions: "💳",
    bills: "💳",
    documents: "📄",
    family: "📄",
    general: "📋",
  };

  const PLACEHOLDER_PRIORITIES = [
    {
      icon: "⚠",
      text: "MOT expires in 14 days",
      sub: "Toyota RAV4 • 12 Dec 2024",
      accent: "red",
      kind: "placeholder",
    },
    {
      icon: "📄",
      text: "School form due Friday",
      sub: "For Emma • 15 Nov 2024",
      accent: "orange",
      kind: "placeholder",
    },
    {
      icon: "💳",
      text: "Netflix renews tomorrow",
      sub: "£15.99 • 14 Nov 2024",
      accent: "purple",
      kind: "placeholder",
    },
    {
      icon: "🛂",
      text: "Passport expires in 3 months",
      sub: "Thierry • 14 Feb 2025",
      accent: "green",
      kind: "placeholder",
    },
  ];

  const INSIGHT_ICONS = ["📈", "✨", "📈"];

  function firstName(fullName) {
    if (!fullName || !fullName.trim()) return "there";
    return fullName.trim().split(/\s+/)[0];
  }

  function getGreetingLine() {
    const hour = new Date().getHours();
    let period = "evening";
    if (hour < 12) period = "morning";
    else if (hour < 17) period = "afternoon";
    const ctx = window.LifeAdminAccess?.getUserContext() || {};
    return `Good ${period} ${firstName(ctx.fullName)}`;
  }

  function daysUntil(dateStr) {
    if (!dateStr) return Infinity;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + "T12:00:00");
    due.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function formatMonths(days) {
    const m = Math.round(days / 30);
    return m === 1 ? "1 month" : `${m} months`;
  }

  function formatReminderPriority(item) {
    const { category, title, days } = item;
    if (days < 0) return `${title} — ${Math.abs(days)} days overdue`;
    if (days === 0) return `${title} — due today`;
    if (days === 1) return `${title} renews tomorrow`;

    if (category === "mot") return `MOT expires in ${days} days`;
    if (category === "passport") {
      return days >= 45
        ? `Passport expires in ${formatMonths(days)}`
        : `Passport expires in ${days} days`;
    }
    if (category === "licence") {
      return days >= 45
        ? `Licence expires in ${formatMonths(days)}`
        : `Licence expires in ${days} days`;
    }
    if (category === "subscriptions" || category === "bills") {
      return `${title} renews in ${days} days`;
    }
    if (/school|form/i.test(title)) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const day = d.toLocaleDateString("en-GB", { weekday: "long" });
      return `School form due ${day}`;
    }
    return `${title} — in ${days} days`;
  }

  function formatTaskPriority(task) {
    const days = daysUntil(task.dueDate);
    if (/school|form/i.test(task.title)) {
      if (days === 1) return "School form due tomorrow";
      if (days >= 0 && days <= 7) {
        const d = new Date(task.dueDate + "T12:00:00");
        return `School form due ${d.toLocaleDateString("en-GB", { weekday: "long" })}`;
      }
    }
    if (days < 0) return `${task.title} — overdue`;
    if (days === 0) return `${task.title} — due today`;
    if (days === 1) return `${task.title} — due tomorrow`;
    if (days <= 14) return `${task.title} — in ${days} days`;
    return `${task.title}`;
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function accentFor(p) {
    if (p.accent) return p.accent;
    const days = p.days ?? 999;
    if (days < 0) return "red";
    if (p.category === "mot" || p.category === "licence") return days <= 14 ? "red" : "green";
    if (p.category === "passport") return days <= 30 ? "orange" : "green";
    if (p.category === "subscriptions" || p.category === "bills") return "purple";
    const t = (p.text || p.title || "").toLowerCase();
    if (/school|form|document/i.test(t)) return "orange";
    if (/netflix|spotify|bill|pay|£/i.test(t)) return "purple";
    if (/passport/i.test(t)) return "green";
    if (/mot|car/i.test(t)) return "red";
    return "orange";
  }

  function buildPrioritySubtext(p) {
    if (p.sub) return p.sub;
    const parts = [];
    if (p.subtitle) parts.push(p.subtitle);
    if (p.title && !p.text?.includes(p.title)) parts.unshift(p.title);
    if (p.dueDate) parts.push(formatDateShort(p.dueDate));
    if (p.amount != null && p.amount !== "") {
      const money = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(p.amount);
      return parts.length ? `${money} • ${parts.join(" • ")}` : money;
    }
    const ctx = window.LifeAdminAccess?.getUserContext() || {};
    if (/passport/i.test(p.text || "") && ctx.fullName) {
      return `${ctx.fullName.split(/\s+/)[0]} • ${formatDateShort(p.dueDate) || "—"}`;
    }
    return parts.filter(Boolean).join(" • ") || "";
  }

  function iconFor(item) {
    if (item.icon) return item.icon;
    if (item.category) return CATEGORY_ICONS[item.category] || "📋";
    const t = (item.text || item.title || "").toLowerCase();
    if (/school|form|document/i.test(t)) return "📄";
    if (/netflix|spotify|bill|pay|£/i.test(t)) return "💳";
    if (/passport/i.test(t)) return "🛂";
    if (/mot|car/i.test(t)) return "⚠";
    return "📋";
  }

  function computeOverview({ notifications, allItems, tasks }) {
    const overdueReminders = allItems.filter((i) => i.days < 0).length;
    const overdueTasks = tasks.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0).length;

    const importantTasks = tasks.filter((t) => {
      if (t.priority === "high") return true;
      const d = daysUntil(t.dueDate);
      return t.dueDate && d >= 0 && d <= 7;
    }).length;

    const upcomingReminders = notifications.filter(
      (n) => n.urgency === "warning" || (n.days >= 0 && n.days <= 14)
    ).length;

    const completedToday = tasks.filter((t) => t.progress >= 100).length;

    return {
      importantTasks,
      upcomingReminders,
      overdue: overdueReminders + overdueTasks,
      completedToday,
    };
  }

  function buildBriefingPriorities(notifications, tasks) {
    const lines = [];

    for (const n of [...notifications].sort((a, b) => a.days - b.days)) {
      lines.push({
        icon: iconFor(n),
        text: formatReminderPriority(n),
        title: n.title,
        subtitle: n.subtitle,
        dueDate: n.dueDate,
        amount: n.amount,
        kind: "reminder",
        category: n.category,
        id: n.id,
        days: n.days,
        sort: n.days,
      });
    }

    for (const t of tasks.filter((x) => x.priority === "high" || x.dueDate)) {
      lines.push({
        icon: iconFor(t),
        text: formatTaskPriority(t),
        title: t.title,
        dueDate: t.dueDate,
        kind: "task",
        taskId: t.id,
        days: daysUntil(t.dueDate),
        sort: daysUntil(t.dueDate),
      });
    }

    lines.sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));

    const merged = lines.slice(0, MAX_PRIORITIES);
    if (merged.length === 0) {
      return PLACEHOLDER_PRIORITIES.slice(0, MAX_PRIORITIES);
    }
    return merged.slice(0, MAX_PRIORITIES);
  }

  function generateInsights({ notifications, allItems, tasks, vaultDocuments }) {
    const insights = [];
    const vaultInsights = window.LifeAdminVaultIntelligence?.generateVaultInsights?.(
      vaultDocuments || []
    );
    if (vaultInsights?.length) {
      for (const v of vaultInsights.slice(0, 2)) {
        insights.push({
          title: v.title,
          sub: v.sub,
          icon: v.icon || "⚠",
          kind: "vault",
          vaultDocId: v.vaultDocId,
        });
      }
    }
    const weekDeadlines = [
      ...allItems.filter((i) => i.days >= 0 && i.days <= 7),
      ...tasks.filter((t) => {
        const d = daysUntil(t.dueDate);
        return t.dueDate && d >= 0 && d <= 7;
      }),
    ];
    const weekTasks = tasks.filter((t) => {
      const d = daysUntil(t.dueDate);
      return t.dueDate && d >= 0 && d <= 7;
    }).length;
    const weekReminders = allItems.filter((i) => i.days >= 0 && i.days <= 7).length;

    const completedWeek = tasks.filter((t) => t.progress >= 100).length;

    if (weekDeadlines.length >= 3) {
      insights.push({
        title: "Busy week ahead",
        sub: `You have ${weekDeadlines.length} deadline${weekDeadlines.length === 1 ? "" : "s"} this week`,
      });
    } else if (weekDeadlines.length >= 2) {
      insights.push({
        title: `You have ${weekDeadlines.length} deadlines this week`,
        sub: `${weekTasks} task${weekTasks === 1 ? "" : "s"} and ${weekReminders} reminder${weekReminders === 1 ? "" : "s"}`,
      });
    }

    if (completedWeek >= 1 && insights.length < MAX_INSIGHTS) {
      insights.push({
        title: "Great progress!",
        sub: `You completed ${completedWeek} task${completedWeek === 1 ? "" : "s"} this week`,
      });
    }

    const overdue = allItems.filter((i) => i.days < 0).length;
    if (overdue > 0 && insights.length < MAX_INSIGHTS) {
      insights.push({
        title: `${overdue} item${overdue === 1 ? "" : "s"} need attention`,
        sub: "Tap a priority to review overdue items",
      });
    }

    if (insights.length === 0) {
      insights.push({
        title: "You're in good shape",
        sub: "Enjoy a calm day — nothing urgent right now",
      });
    }

    const sorted = [...insights].sort((a, b) => {
      if (a.kind === "vault" && b.kind !== "vault") return -1;
      if (b.kind === "vault" && a.kind !== "vault") return 1;
      return 0;
    });
    return sorted.slice(0, MAX_INSIGHTS);
  }

  /** Placeholder AI — parse brain dump into task objects */
  function parseBrainDump(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];

    const lines = raw
      .split(/\n/)
      .flatMap((line) => line.split(/[,;]+/))
      .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
      .filter((l) => l.length > 1);

    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);

    function nextWeekday(targetDay) {
      const d = new Date(today);
      const diff = (targetDay + 7 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return iso(d);
    }

    return lines.map((line) => {
      const lower = line.toLowerCase();
      let category = "general";
      let priority = "medium";
      let dueDate = "";
      const tags = ["brain-dump"];

      if (/passport/i.test(line)) category = "passport";
      else if (/mot|vehicle|car/i.test(line)) category = "mot";
      else if (/licen[cs]e|driving/i.test(line)) category = "licence";
      else if (/netflix|spotify|subscription/i.test(line)) category = "subscriptions";
      else if (/bill|tax|council|energy/i.test(line)) category = "bills";
      else if (/school|form|document/i.test(line)) category = "documents";

      if (/urgent|asap|important/i.test(line)) priority = "high";
      if (/tomorrow/i.test(line)) dueDate = iso(new Date(today.getTime() + 86400000));
      if (/today/i.test(line)) dueDate = iso(today);
      if (/friday/i.test(line)) dueDate = nextWeekday(5);
      if (/monday/i.test(line)) dueDate = nextWeekday(1);
      if (/next week/i.test(line)) {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        dueDate = iso(d);
      }

      return {
        id: crypto.randomUUID(),
        title: line.charAt(0).toUpperCase() + line.slice(1),
        description: "Captured via brain dump",
        category,
        priority,
        dueDate,
        startDate: iso(today),
        estimatedDuration: null,
        tags,
        isRecurring: false,
        recurringRule: "",
        progress: 0,
        subtasks: [],
      };
    });
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderBriefing(els, data, handlers) {
    if (els.globalHeaderGreeting) {
      els.globalHeaderGreeting.textContent = `Hi ${firstName(
        window.LifeAdminAccess?.getUserContext?.()?.fullName
      )} 👋`;
    }

    const o = data.overview;
    if (els.statImportant) els.statImportant.textContent = String(o.importantTasks);
    if (els.statUpcoming) els.statUpcoming.textContent = String(o.upcomingReminders);
    if (els.statOverdue) els.statOverdue.textContent = String(o.overdue);
    if (els.statCompleted) els.statCompleted.textContent = String(o.completedToday);

    const priorityTargets = [
      els.briefingPriorities,
      els.briefingPrioritiesTop,
    ].filter(Boolean);
    if (priorityTargets.length === 0) return;

    const cap = window.LifeAdminOS?.LIST_CAP || 5;
    const priorities = (data.priorities || []).slice(0, cap);
    const insights = (data.insights || []).slice(0, cap);

    priorityTargets.forEach((ul) => ul.replaceChildren());
    if (priorities.length === 0) {
      priorityTargets.forEach((ul) => {
        const li = document.createElement("li");
        li.className = "empty-line";
        li.textContent = "Nothing urgent — enjoy your day.";
        ul.appendChild(li);
      });
    } else {
      for (const p of priorities) {
        priorityTargets.forEach((ul) => {
          const li = document.createElement("li");
          const accent = accentFor(p);
          const sub = buildPrioritySubtext(p);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `priority-row priority-row--${accent}`;
          btn.innerHTML = `
          <span class="priority-row__icon priority-row__icon--${accent}">${p.icon}</span>
          <span class="priority-row__body">
            <span class="priority-row__title">${escape(p.text)}</span>
            ${sub ? `<span class="priority-row__sub">${escape(sub)}</span>` : ""}
          </span>
          <span class="priority-row__chev" aria-hidden="true">›</span>`;
          if (p.kind !== "placeholder") {
            if (p.taskId && handlers.onOpenTask) {
              btn.addEventListener("click", () => handlers.onOpenTask(p.taskId));
            } else if (p.id && handlers.onOpenReminder) {
              btn.addEventListener("click", () => handlers.onOpenReminder(p.category, p.id));
            }
          }
          li.appendChild(btn);
          ul.appendChild(li);
        });
      }
    }

    const insightTargets = [els.briefingInsights, els.briefingInsightsTop].filter(Boolean);
    insightTargets.forEach((ul) => ul.replaceChildren());
    insights.forEach((insight, i) => {
      const item = typeof insight === "string" ? { title: insight, sub: "" } : insight;
      insightTargets.forEach((ul) => {
        const li = document.createElement("li");
        li.className = "insight-row";
        const icon =
          item.icon || (item.kind === "vault" ? "⚠" : INSIGHT_ICONS[i % INSIGHT_ICONS.length]);
        const iconClass =
          item.kind === "vault" ? "insight-row__icon insight-row__icon--warn" : "insight-row__icon";
        li.innerHTML = `
          <span class="${iconClass}" aria-hidden="true">${icon}</span>
          <span class="insight-row__body">
            <span class="insight-row__title">${escape(item.title)}</span>
            ${item.sub ? `<span class="insight-row__sub">${escape(item.sub)}</span>` : ""}
          </span>`;
        ul.appendChild(li);
      });
    });

    const count = data.notificationCount || 0;
    if (els.headerNotificationBadge) {
      els.headerNotificationBadge.hidden = count === 0;
      els.headerNotificationBadge.textContent = count > 99 ? "99+" : String(count);
    }
    if (els.headerBellDot) {
      els.headerBellDot.hidden = count === 0;
    }
  }

  function initBrainDump(els, handlers) {
    function openBrainDump() {
      els.brainDumpText.value = "";
      els.brainDumpResult.hidden = true;
      els.brainDumpModal.showModal();
      els.brainDumpText.focus();
    }

    window.LifeAdminBriefing.openBrainDump = openBrainDump;

    els.brainDumpClose.addEventListener("click", () => els.brainDumpModal.close());
    els.brainDumpModal.addEventListener("click", (e) => {
      if (e.target === els.brainDumpModal) els.brainDumpModal.close();
    });

    els.brainDumpConvert.addEventListener("click", async () => {
      const parsed = parseBrainDump(els.brainDumpText.value);
      if (!parsed.length) {
        alert("Type one idea per line — we'll turn them into tasks.");
        return;
      }
      els.brainDumpConvert.disabled = true;
      els.brainDumpConvert.textContent = "Creating…";
      try {
        const created = await handlers.onCreateTasks(parsed);
        els.brainDumpResult.hidden = false;
        els.brainDumpResult.textContent = `Created ${created.length} task${created.length === 1 ? "" : "s"} from your brain dump.`;
        setTimeout(() => els.brainDumpModal.close(), 1000);
      } catch (err) {
        alert(`Could not create tasks: ${err.message}`);
      } finally {
        els.brainDumpConvert.disabled = false;
        els.brainDumpConvert.textContent = "Convert to tasks";
      }
    });
  }

  window.LifeAdminBriefing = {
    computeOverview,
    buildBriefingPriorities,
    generateInsights,
    parseBrainDump,
    renderBriefing,
    initBrainDump,
    openBrainDump: null,
    getGreetingLine,
  };
})();
