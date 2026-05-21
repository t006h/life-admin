/**
 * Life Admin — intent engine (delegates to Workflow Engine; legacy fallbacks)
 */
(function () {
  function normalize(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function dueInDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function finish(text, summary, icon, confidence, actions) {
    return {
      text,
      summary,
      icon,
      confidence,
      actions,
      primary: actions[0] || null,
    };
  }

  function parseLegacy(raw) {
    const text = normalize(raw);
    if (!text) return null;
    const lower = text.toLowerCase();
    const actions = [];

    if (/\b(plan(ning)?|schedule|calendar|time block|my week)\b/i.test(text)) {
      const actions = [
        { id: "plan", type: "calendar", label: "Open Planning" },
        { id: "plan_week", type: "plan_week", label: "Plan my week" },
      ];
      if (/\bweek\b/i.test(text)) {
        return finish(text, "Plan your week with AI time blocks", "📅", "high", actions);
      }
      return finish(text, "Open your calendar and plan the week", "📅", "high", actions);
    }

    if (/\b(mot|car test|book garage|garage)\b/i.test(text)) {
      return finish(text, "Track your MOT and book a garage slot", "🚗", "high", [
        {
          id: "reminder",
          type: "reminder",
          category: "mot",
          label: "Add MOT reminder",
          title: /\bbook\b/i.test(text) ? "Book MOT / garage" : "MOT due",
          dueDate: dueInDays(14),
        },
        {
          id: "task",
          type: "task",
          label: "Create task: book garage",
          title: "Book garage for MOT",
          priority: "high",
        },
      ]);
    }

    if (/\b(insurance|renew insurance|home insurance|car insurance)\b/i.test(text)) {
      return finish(text, "Remind you to review or renew insurance", "🛡️", "high", [
        {
          id: "reminder",
          type: "reminder",
          category: "bills",
          label: "Add insurance reminder",
          title: "Renew insurance",
          dueDate: dueInDays(30),
        },
        { id: "task", type: "task", label: "Compare quotes", title: "Compare insurance quotes", category: "documents" },
        { id: "ai", type: "ai_suggestion", label: "Insurance timing tips", hint: "insurance" },
      ]);
    }

    if (/\b(netflix|subscription|spotify)\b/i.test(text)) {
      return finish(text, "Track a subscription renewal", "💳", "high", [
        {
          id: "reminder",
          type: "reminder",
          category: "subscriptions",
          label: "Add subscription reminder",
          title: text,
          dueDate: dueInDays(7),
        },
      ]);
    }

    if (/\b(bill|pay bill|council tax|utilities)\b/i.test(text)) {
      return finish(text, "Add a bill reminder", "💳", "high", [
        {
          id: "reminder",
          type: "reminder",
          category: "bills",
          label: "Add bill reminder",
          title: text,
          dueDate: dueInDays(14),
        },
      ]);
    }

    if (/\b(document|upload|scan|vault|passport copy|receipt)\b/i.test(text)) {
      return finish(text, "Open your document vault", "🛡️", "high", [
        { id: "vault", type: "vault", label: "Open Vault" },
        { id: "vault_upload", type: "vault_upload", label: "Upload a document" },
      ]);
    }

    if (/\b(licen[cs]e|driving)\b/i.test(text)) {
      return finish(text, "Track driving licence expiry", "🪪", "high", [
        {
          id: "reminder",
          type: "reminder",
          category: "licence",
          label: "Add licence reminder",
          title: "Driving licence renewal",
          dueDate: dueInDays(180),
        },
      ]);
    }

    if (/\b(family|child|partner)\b/i.test(text) && !/school trip/i.test(text)) {
      return finish(text, "Open family — reminders and shared tasks", "👨‍👩‍👧", "medium", [
        { id: "family", type: "navigate", view: "family", label: "Open Family" },
        { id: "task", type: "task", label: "Add family task", title: text, category: "family" },
      ]);
    }

    if (/\b(task|todo|remember to|need to)\b/i.test(text)) {
      return finish(text, "Add this as a task", "✓", "medium", [
        {
          id: "task",
          type: "task",
          label: "Create task",
          title: text.replace(/^(task|todo):?\s*/i, ""),
          dueDate: dueInDays(3),
        },
      ]);
    }

    if (/\b(remind|reminder|due|expires?)\b/i.test(text)) {
      const cat = /passport/.test(lower) ? "passport" : /mot|car/.test(lower) ? "mot" : /bill/.test(lower) ? "bills" : "mot";
      return finish(text, "Create a reminder from your request", "🔔", "medium", [
        {
          id: "reminder",
          type: "reminder",
          category: cat,
          label: "Add reminder",
          title: text,
          dueDate: dueInDays(30),
        },
      ]);
    }

    return null;
  }

  const REMINDER_CATEGORY_META = {
    mot: { label: "MOT", icon: "🚗", defaultDueDays: 14 },
    passport: { label: "Passport", icon: "🛂", defaultDueDays: 180 },
    licence: { label: "Driving licence", icon: "🪪", defaultDueDays: 180 },
    subscriptions: { label: "Subscription", icon: "💳", defaultDueDays: 7 },
    bills: { label: "Bill", icon: "£", defaultDueDays: 14 },
  };

  function cleanReminderTitle(text) {
    return normalize(text)
      .replace(/^(please\s+)?(remind me( to)?|remember to|add a reminder( for)?)\s+/i, "")
      .replace(/\s+(due|expires?|expiring)\s+/i, " ")
      .trim() || normalize(text);
  }

  function extractDueDateFromText(text) {
    const lower = text.toLowerCase();
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return iso[0];
    const slash = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
    if (slash) {
      const [, d, m, y] = slash;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
    if (inDays) return dueInDays(Number(inDays[1]));
    const months = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    for (const [name, idx] of Object.entries(months)) {
      if (!lower.includes(name)) continue;
      const yearMatch = lower.match(/\b(20\d{2})\b/);
      const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
      const d = new Date(year, idx, 15);
      if (d < new Date()) d.setFullYear(year + 1);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  /** Classify free-text into a reminder category (onboarding + quick add). */
  function categorizeReminder(raw) {
    const text = normalize(raw);
    if (!text) return null;

    const lower = text.toLowerCase();
    const title = cleanReminderTitle(text);
    const parsedDue = extractDueDateFromText(text);

    const rules = [
      { re: /\b(passport|visa)\b/i, category: "passport" },
      { re: /\b(mot|car test|garage|vehicle)\b/i, category: "mot" },
      { re: /\b(licen[cs]e|driving)\b/i, category: "licence" },
      { re: /\b(netflix|spotify|subscription|prime|disney|apple music)\b/i, category: "subscriptions" },
      { re: /\b(bill|council tax|utilities|insurance|rent|mortgage|payment|tax)\b/i, category: "bills" },
      { re: /\b(dentist|doctor|appointment)\b/i, category: "bills" },
    ];

    for (const { re, category } of rules) {
      if (re.test(lower)) {
        const meta = REMINDER_CATEGORY_META[category];
        return {
          category,
          title,
          dueDate: parsedDue || dueInDays(meta.defaultDueDays),
          label: meta.label,
          icon: meta.icon,
          summary: `Sorted as ${meta.icon} ${meta.label}`,
        };
      }
    }

    const legacy = parseLegacy(text);
    const reminderAction = legacy?.actions?.find((a) => a.type === "reminder");
    if (reminderAction?.category) {
      const meta = REMINDER_CATEGORY_META[reminderAction.category] || REMINDER_CATEGORY_META.bills;
      return {
        category: reminderAction.category,
        title: reminderAction.title || title,
        dueDate: reminderAction.dueDate || parsedDue || dueInDays(meta.defaultDueDays),
        label: meta.label,
        icon: meta.icon,
        summary: `Sorted as ${meta.icon} ${meta.label}`,
      };
    }

    const meta = REMINDER_CATEGORY_META.bills;
    return {
      category: "bills",
      title,
      dueDate: parsedDue || dueInDays(meta.defaultDueDays),
      label: meta.label,
      icon: meta.icon,
      summary: `Sorted as ${meta.icon} ${meta.label}`,
    };
  }

  function cleanTaskTitle(text) {
    return normalize(text)
      .replace(/^(please\s+)?(add a )?task:?\s+/i, "")
      .replace(/^(remember to|need to)\s+/i, "")
      .trim() || normalize(text);
  }

  /** Reminder vs task + category for onboarding. */
  function classifyOnboardingInput(raw) {
    const text = normalize(raw);
    if (!text) return null;

    const lower = text.toLowerCase();
    const taskSignals =
      /\b(task|todo|to-do|remember to|need to|pick up|call|email|send|organize|pack|buy|book appointment)\b/i;
    const reminderSignals =
      /\b(remind|reminder|renew|due|expires?|expiry|mot|passport|licen[cs]e|bill|subscription|insurance|tax|council|netflix|spotify)\b/i;

    const preferTask = taskSignals.test(lower) && !reminderSignals.test(lower);

    if (preferTask) {
      return {
        kind: "task",
        title: cleanTaskTitle(text),
        dueDate: extractDueDateFromText(text) || dueInDays(3),
        icon: "✓",
        label: "Task",
        summary: "We'll add this as a task",
        category: "general",
      };
    }

    const rem = categorizeReminder(text);
    if (!rem) return null;
    return {
      kind: "reminder",
      category: rem.category,
      title: rem.title,
      dueDate: rem.dueDate,
      icon: rem.icon,
      label: rem.label,
      summary: rem.summary,
    };
  }

  function parseIntent(raw) {
    const wf = window.LifeAdminWorkflowEngine?.parseIntent?.(raw);
    const detection = window.LifeAdminWorkflowEngine?.detectIntent?.(raw);

    if (detection && detection.blueprintId !== "generic" && detection.confidence === "high") {
      return wf;
    }

    const legacy = parseLegacy(raw);
    if (legacy) return legacy;

    return wf;
  }

  const EXAMPLE_CHIPS = window.LifeAdminWorkflowEngine?.EXAMPLE_CHIPS || [
    "Renew my passport",
    "We're moving house",
    "Theo has a school trip",
    "Plan our holiday",
    "Book dentist",
  ];

  window.LifeAdminIntentEngine = {
    parseIntent,
    categorizeReminder,
    classifyOnboardingInput,
    EXAMPLE_CHIPS,
  };
})();
