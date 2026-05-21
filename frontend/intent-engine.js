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
    EXAMPLE_CHIPS,
  };
})();
