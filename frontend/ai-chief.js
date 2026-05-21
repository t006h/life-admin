/**
 * Life Admin — AI Chief of Staff v1 (rules + placeholder intelligence, no real AI)
 */
(function () {
  const Access = () => window.LifeAdminAccess;
  const FEATURE = () => Access().FEATURES.AI_ASSISTANT;

  const ACTION_CTA = {
    mot: "Book garage",
    passport: "Start renewal process",
    insurance: "Renew policy",
    school: "Complete form",
    subscription: "Review subscription",
    task: "Open task",
    bill: "Pay or schedule",
    vault: "Open in vault",
  };

  function firstName() {
    const ctx = Access()?.getUserContext() || {};
    if (!ctx.fullName?.trim()) return "there";
    return ctx.fullName.trim().split(/\s+/)[0];
  }

  function greetingLine() {
    if (window.LifeAdminBriefing?.getGreetingLine) {
      return window.LifeAdminBriefing.getGreetingLine();
    }
    const hour = new Date().getHours();
    let period = "evening";
    if (hour < 12) period = "morning";
    else if (hour < 17) period = "afternoon";
    return `Good ${period} ${firstName()}`;
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + "T12:00:00");
    due.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function formatMonths(days) {
    const m = Math.max(1, Math.round(days / 30));
    return m === 1 ? "1 month" : `${m} months`;
  }

  function formatWeekday(dateStr) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
  }

  function canUseAi() {
    return Access().canAccess(FEATURE());
  }

  function computeCounts({ overview, notifications, tasks, allItems }) {
    const importantTasks =
      overview?.importantTasks ??
      tasks.filter((t) => t.priority === "high" || (t.dueDate && daysUntil(t.dueDate) <= 7)).length;
    const reminders =
      overview?.upcomingReminders ?? notifications.length;
    const upcoming =
      allItems.filter((i) => i.days >= 0 && i.days <= 14).length +
      tasks.filter((t) => {
        const d = daysUntil(t.dueDate);
        return d != null && d >= 0 && d <= 14;
      }).length;

    return { importantTasks, reminders, upcoming };
  }

  /** Rule-based suggested actions from live data */
  function generateSuggestedActions(ctx) {
    const actions = [];
    const { allItems, notifications, tasks, vaultDocuments } = ctx;

    for (const item of [...notifications, ...allItems].sort((a, b) => a.days - b.days)) {
      if (!Access().canAccessCategory(item.category)) continue;
      const days = item.days;

      if (item.category === "mot" && days >= 0 && days <= 30) {
        actions.push({
          icon: "⚠",
          headline: `MOT expires in ${days} days`,
          cta: ACTION_CTA.mot,
          sub: item.subtitle || item.title,
          kind: "reminder",
          category: item.category,
          id: item.id,
          sort: days,
        });
      }

      if (item.category === "passport" && days >= 0 && days <= 180) {
        actions.push({
          icon: "⚠",
          headline:
            days <= 45
              ? `Passport expires in ${days} days`
              : `Passport expires in ${formatMonths(days)}`,
          cta: ACTION_CTA.passport,
          sub: item.title,
          kind: "reminder",
          category: item.category,
          id: item.id,
          sort: days + 100,
        });
      }

      if (
        (item.category === "subscriptions" || item.category === "bills") &&
        days >= 0 &&
        days <= 14
      ) {
        const isNetflix = /netflix/i.test(item.title);
        const priceNote =
          isNetflix && item.amount != null && item.amount >= 15
            ? "Review subscription — price may have changed"
            : isNetflix
              ? "Review subscription"
              : item.subtitle || "";
        actions.push({
          icon: "💳",
          headline: isNetflix
            ? item.amount != null
              ? "Netflix increased price"
              : "Netflix renews soon"
            : `${item.title} due in ${days === 0 ? "today" : `${days} days`}`,
          cta: isNetflix ? ACTION_CTA.subscription : ACTION_CTA.bill,
          sub: priceNote,
          kind: "reminder",
          category: item.category,
          id: item.id,
          sort: days + 50,
        });
      }

      if (/school|form/i.test(item.title) && days >= 0 && days <= 7) {
        actions.push({
          icon: "📄",
          headline: `School form due ${days === 1 ? "tomorrow" : formatWeekday(item.dueDate)}`,
          cta: ACTION_CTA.school,
          sub: item.subtitle || "Family admin",
          kind: "reminder",
          category: item.category,
          id: item.id,
          sort: days + 40,
        });
      }
    }

    for (const doc of vaultDocuments || []) {
      const intel = window.LifeAdminVaultIntelligence;
      if (!intel?.insightFromDocument) continue;
      const insight = intel.insightFromDocument(doc);
      if (!insight) continue;
      const days = window.LifeAdminVaultIntelligence?.daysUntil?.(doc.expiryDate);
      if (days == null) continue;
      actions.push({
        icon: insight.icon || "⚠",
        headline: (insight.title || "").replace(/^⚠\s*/, ""),
        cta:
          doc.category === "passport"
            ? ACTION_CTA.passport
            : doc.category === "insurance"
              ? ACTION_CTA.insurance
              : ACTION_CTA.vault,
        sub: insight.sub,
        kind: "vault",
        vaultDocId: doc.id,
        sort: days + 80,
      });
    }

    for (const t of tasks) {
      const d = daysUntil(t.dueDate);
      if (t.priority === "high" && d != null && d <= 7) {
        actions.push({
          icon: "✓",
          headline: t.title,
          cta: ACTION_CTA.task,
          sub: d < 0 ? "Overdue" : d === 0 ? "Due today" : `Due in ${d} days`,
          kind: "task",
          taskId: t.id,
          sort: d < 0 ? -5 : d,
        });
      }
    }

    if (actions.length === 0) {
      actions.push({
        icon: "✨",
        headline: "You're in good shape",
        cta: "Add a task",
        sub: "Nothing urgent — use Brain Dump on Today to capture ideas",
        kind: "placeholder",
        sort: 999,
      });
    }

    const seen = new Set();
    return actions
      .sort((a, b) => a.sort - b.sort)
      .filter((a) => {
        const key = `${a.kind}-${a.id || a.taskId || a.vaultDocId || a.headline}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, window.LifeAdminOS?.LIST_CAP || 5);
  }

  function generateFamilySummary(ctx) {
    const members = window.LifeAdminFamily?.getMembers?.() || [];
    if (!members.length) {
      return "Add family members from the menu to unlock household summaries and shared reminders.";
    }
    const names = members.map((m) => m.name).join(", ");
    const reminders = window.LifeAdminFamily?.getReminders?.() || [];
    const school = reminders.filter((r) => /school|trip|form/i.test(r.title || "")).length;
    return `Household: ${names}. ${reminders.length} family reminder${reminders.length === 1 ? "" : "s"}${school ? ` · ${school} school-related` : ""}.`;
  }

  function generateRisksSummary(ctx) {
    const hints = generateForgettingHints(ctx).slice(0, 3);
    const urgent = (ctx?.notifications || []).filter((n) => n.days <= 7);
    if (!hints.length && !urgent.length) {
      return "No elevated risks this week — you're in good shape.";
    }
    const parts = urgent.slice(0, 2).map((u) => u.title);
    hints.forEach((h) => parts.push(h.text));
    return parts.slice(0, 4).join(" · ");
  }

  /** "What am I forgetting?" — seasonal / pattern placeholders */
  function generateForgettingHints(ctx) {
    const hints = [];
    const now = new Date();
    const month = now.getMonth();
    const { allItems, vaultDocuments } = ctx;

    const hasInsurance = [...allItems, ...(vaultDocuments || [])].some(
      (x) =>
        x.category === "insurance" ||
        x.category === "bills" ||
        /insurance/i.test(x.title || "")
    );

    if ([2, 3, 8, 9].includes(month) && !hasInsurance) {
      hints.push({
        icon: "🛡️",
        text: "You usually renew insurance around this time",
        sub: "Check home and car policies",
      });
    } else if (hasInsurance) {
      const ins = vaultDocuments?.find((d) => d.category === "insurance");
      if (ins?.expiryDate) {
        const days = daysUntil(ins.expiryDate);
        if (days != null && days > 30 && days < 120) {
          hints.push({
            icon: "🛡️",
            text: "Insurance renewal coming up — compare quotes early",
            sub: ins.title,
          });
        }
      }
    }

    if ([6, 7].includes(month)) {
      hints.push({
        icon: "🏖️",
        text: "School holidays begin next week",
        sub: "Plan childcare and travel documents",
      });
    }

    if (month === 10 || month === 11) {
      hints.push({
        icon: "🐾",
        text: "Pet vaccination due next month",
        sub: "Placeholder — add vet dates to your vault",
      });
    }

    const mot = allItems.find((i) => i.category === "mot");
    if (mot && mot.days > 60) {
      hints.push({
        icon: "🚗",
        text: "MOT is a while away — book early for popular garages",
        sub: `${mot.title} · ${mot.days} days`,
      });
    }

    if (hints.length === 0) {
      hints.push({
        icon: "💡",
        text: "Review your vault monthly for missing documents",
        sub: "Passports, insurance, and school forms in one place",
      });
    }

    return hints.slice(0, window.LifeAdminOS?.LIST_CAP || 5);
  }

  /** Weekly plan — rule-based priority + time blocks */
  function generateWeeklyPlan(ctx) {
    const { tasks, allItems, notifications } = ctx;
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const startDay = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - startDay);

    const priorities = [];

    for (const item of [...notifications].sort((a, b) => a.days - b.days)) {
      if (item.days <= 14) {
        priorities.push({
          rank: priorities.length + 1,
          label: item.title,
          meta: `${item.category} · ${item.days}d`,
          urgency: item.days <= 7 ? "high" : "medium",
        });
      }
    }

    for (const t of [...tasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
    })) {
      const d = daysUntil(t.dueDate);
      if (d != null && d <= 14 && t.progress < 100) {
        priorities.push({
          rank: priorities.length + 1,
          label: t.title,
          meta: `Task · ${d}d · ${t.priority}`,
          urgency: t.priority === "high" ? "high" : "medium",
        });
      }
    }

    const blocks = [];
    let totalMinutes = 0;
    const workloadTasks = tasks.filter((t) => t.progress < 100 && t.dueDate);

    for (let i = 0; i < 5; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayTasks = workloadTasks.filter((t) => t.dueDate === iso);
      const dayLabel = dayNames[i];

      if (dayTasks.length === 0 && i < 3) {
        blocks.push({
          day: dayLabel,
          slot: "Morning",
          label: "Admin catch-up",
          minutes: 30,
        });
        totalMinutes += 30;
      } else {
        dayTasks.forEach((t, idx) => {
          const mins = t.estimatedDuration || 45;
          totalMinutes += mins;
          blocks.push({
            day: dayLabel,
            slot: idx % 2 === 0 ? "Morning" : "Afternoon",
            label: t.title,
            minutes: mins,
          });
        });
      }
    }

    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    let workloadLabel = "Light";
    if (hours >= 8) workloadLabel = "Heavy";
    else if (hours >= 4) workloadLabel = "Moderate";

    return {
      generatedAt: new Date().toISOString(),
      priorities: priorities.slice(0, 8),
      blocks: blocks.slice(0, 10),
      workload: {
        hours,
        label: workloadLabel,
        taskCount: workloadTasks.length,
      },
    };
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  let els = {};
  let handlers = {};
  let lastContext = null;

  function renderLocked() {
    if (els.aiContent) els.aiContent.hidden = true;
    if (els.aiUpgradeCard) {
      els.aiUpgradeCard.hidden = false;
      if (els.aiUpgradeText) {
        els.aiUpgradeText.textContent = Access().getUpgradeMessage(FEATURE());
      }
    }
  }

  function renderActionRow(action) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-action-row";
    btn.innerHTML = `
      <span class="ai-action-row__icon">${action.icon}</span>
      <span class="ai-action-row__body">
        <span class="ai-action-row__headline">${escape(action.headline)}</span>
        <span class="ai-action-row__cta">→ ${escape(action.cta)}</span>
        ${action.sub ? `<span class="ai-action-row__sub">${escape(action.sub)}</span>` : ""}
      </span>`;
    if (action.kind === "reminder" && handlers.onOpenReminder) {
      btn.addEventListener("click", () =>
        handlers.onOpenReminder(action.category, action.id)
      );
    } else if (action.kind === "task" && handlers.onOpenTask) {
      btn.addEventListener("click", () => handlers.onOpenTask(action.taskId));
    } else if (action.kind === "vault" && handlers.onOpenVault) {
      btn.addEventListener("click", () => handlers.onOpenVault(action.vaultDocId));
    }
    li.appendChild(btn);
    return li;
  }

  function renderHintRow(hint) {
    const li = document.createElement("li");
    li.className = "ai-hint-row";
    li.innerHTML = `
      <span class="ai-hint-row__icon">${hint.icon}</span>
      <span class="ai-hint-row__body">
        <span class="ai-hint-row__text">${escape(hint.text)}</span>
        ${hint.sub ? `<span class="ai-hint-row__sub">${escape(hint.sub)}</span>` : ""}
      </span>`;
    return li;
  }

  function renderWeeklyPlan(plan) {
    if (!els.aiWeeklyPlan) return;
    els.aiWeeklyPlan.hidden = false;

    els.aiPriorityList.replaceChildren();
    if (plan.priorities.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-line";
      li.textContent = "No urgent items this week.";
      els.aiPriorityList.appendChild(li);
    } else {
      plan.priorities.forEach((p) => {
        const li = document.createElement("li");
        li.className = `ai-priority-item ai-priority-item--${p.urgency}`;
        li.innerHTML = `<span class="ai-priority-item__rank">${p.rank}</span><span class="ai-priority-item__label">${escape(p.label)}</span><span class="ai-priority-item__meta">${escape(p.meta)}</span>`;
        els.aiPriorityList.appendChild(li);
      });
    }

    els.aiBlocksList.replaceChildren();
    plan.blocks.forEach((b) => {
      const li = document.createElement("li");
      li.className = "ai-block-item";
      li.innerHTML = `
        <span class="ai-block-item__day">${escape(b.day)}</span>
        <span class="ai-block-item__slot">${escape(b.slot)}</span>
        <span class="ai-block-item__label">${escape(b.label)}</span>
        <span class="ai-block-item__mins">${b.minutes}m</span>`;
      els.aiBlocksList.appendChild(li);
    });

    els.aiWorkload.textContent = `${plan.workload.label} — ~${plan.workload.hours}h across ${plan.workload.taskCount} tasks`;
  }

  function render(context, h) {
    lastContext = context;
    handlers = h || {};

    if (!els.aiContent && !els.aiGreeting) {
      console.warn("AI Chief: DOM elements missing — was init() called?");
      return;
    }

    if (!canUseAi()) {
      renderLocked();
      return;
    }

    if (els.aiUpgradeCard) els.aiUpgradeCard.hidden = true;
    if (els.aiContent) els.aiContent.hidden = false;

    const counts = computeCounts(context);
    if (els.aiGreeting) els.aiGreeting.textContent = greetingLine();
    if (els.aiStatTasks) els.aiStatTasks.textContent = String(counts.importantTasks);
    if (els.aiStatReminders) els.aiStatReminders.textContent = String(counts.reminders);
    if (els.aiStatUpcoming) els.aiStatUpcoming.textContent = String(counts.upcoming);

    let actions = [];
    try {
      actions = generateSuggestedActions(context) || [];
    } catch (err) {
      console.error("AI suggested actions failed:", err);
    }
    if (!actions.length) {
      actions.push({
        icon: "✨",
        headline: "You're in good shape",
        cta: "Add a task",
        sub: "Nothing urgent right now",
        kind: "placeholder",
        sort: 999,
      });
    }
    if (els.aiActionsList) {
      els.aiActionsList.replaceChildren();
      actions.forEach((a) => els.aiActionsList.appendChild(renderActionRow(a)));
    }

    const hints = generateForgettingHints(context);
    if (els.aiHintsList) {
      els.aiHintsList.replaceChildren();
      hints.forEach((hint) => els.aiHintsList.appendChild(renderHintRow(hint)));
    }

    if (els.aiWeeklyPlan) els.aiWeeklyPlan.hidden = true;
  }

  function bindEvents() {
    els.btnPlanWeek?.addEventListener("click", () => {
      if (!lastContext) return;
      const plan = generateWeeklyPlan(lastContext);
      renderWeeklyPlan(plan);
      els.aiWeeklyPlan?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function init(dom, h) {
    els = {
      aiUpgradeCard: dom.aiUpgradeCard,
      aiUpgradeText: dom.aiUpgradeText,
      aiContent: dom.aiContent,
      aiGreeting: dom.aiGreeting,
      aiStatTasks: dom.aiStatTasks,
      aiStatReminders: dom.aiStatReminders,
      aiStatUpcoming: dom.aiStatUpcoming,
      aiActionsList: dom.aiActionsList,
      aiHintsList: dom.aiHintsList,
      btnPlanWeek: dom.btnPlanWeek,
      aiWeeklyPlan: dom.aiWeeklyPlan,
      aiPriorityList: dom.aiPriorityList,
      aiBlocksList: dom.aiBlocksList,
      aiWorkload: dom.aiWorkload,
    };
    handlers = h || {};
    bindEvents();
  }

  window.LifeAdminAiChief = {
    init,
    render,
    canUseAi,
    generateSuggestedActions,
    generateForgettingHints,
    generateWeeklyPlan,
    generateFamilySummary,
    generateRisksSummary,
  };
})();
