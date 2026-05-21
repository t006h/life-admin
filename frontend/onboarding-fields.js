/**
 * Life Admin — onboarding intent → missing fields only
 */
(function () {
  const SCHEMAS = {
    mot: {
      lead: "I can set this up for you.",
      fields: [
        { id: "registration", label: "Vehicle registration", type: "text", required: true },
        { id: "motDate", label: "MOT date", type: "date", required: true },
      ],
      blueprintId: null,
      fallbackCategory: "mot",
    },
    school_trip: {
      lead: "I can set this up for you.",
      fields: [
        { id: "tripDate", label: "Trip date", type: "date", required: true },
        { id: "school", label: "School", type: "text", required: true },
        { id: "childName", label: "Child's name", type: "text", required: false },
      ],
      blueprintId: "school_trip",
      fallbackCategory: "bills",
    },
    passport: {
      lead: "I can set this up for you.",
      fields: [
        { id: "holder", label: "Passport holder", type: "text", required: false },
        { id: "expiryDate", label: "Expiry date", type: "date", required: true },
      ],
      blueprintId: "passport_renewal",
      fallbackCategory: "passport",
    },
    insurance: {
      lead: "I can set this up for you.",
      fields: [
        { id: "title", label: "What to pay / renew", type: "text", required: true },
        { id: "dueDate", label: "Due date", type: "date", required: true },
      ],
      blueprintId: null,
      fallbackCategory: "bills",
    },
    generic: {
      lead: "I can set this up for you.",
      fields: [
        { id: "title", label: "Title", type: "text", required: true },
        { id: "dueDate", label: "Due date", type: "date", required: true },
      ],
      blueprintId: null,
      fallbackCategory: "bills",
    },
    task: {
      lead: "I'll add this as a task.",
      fields: [
        { id: "title", label: "Task", type: "text", required: true },
        { id: "dueDate", label: "Due date", type: "date", required: true },
      ],
      blueprintId: null,
      kind: "task",
    },
  };

  function detectSchema(text) {
    const t = String(text || "").trim();
    const lower = t.toLowerCase();
    if (!t) return null;

    const wf = window.LifeAdminWorkflowEngine?.detectIntent?.(t);
    if (/\b(mot|bmw|garage|car test)\b/i.test(lower)) return { schemaId: "mot", detection: wf, raw: t };
    if (/\b(school trip|school form|parents evening)\b/i.test(lower) || /\bhas a school\b/i.test(t)) {
      return { schemaId: "school_trip", detection: wf, raw: t, childName: wf?.personName };
    }
    if (/\b(passport|renew passport)\b/i.test(lower)) return { schemaId: "passport", detection: wf, raw: t };
    if (/\b(insurance|pay insurance|renew insurance)\b/i.test(lower)) {
      return { schemaId: "insurance", detection: wf, raw: t };
    }
    if (/\b(holiday|moving house|new job)\b/i.test(lower) && wf?.blueprintId !== "generic") {
      return { schemaId: "generic", detection: wf, raw: t, preferWorkflow: true };
    }

    const classified = window.LifeAdminIntentEngine?.classifyOnboardingInput?.(t);
    if (classified?.kind === "task") return { schemaId: "task", detection: wf, raw: t, classified };

    return { schemaId: "generic", detection: wf, raw: t, classified };
  }

  function getSchema(schemaId) {
    return SCHEMAS[schemaId] || SCHEMAS.generic;
  }

  function defaultValues(match) {
    const schema = getSchema(match.schemaId);
    const vals = {};
    if (match.schemaId === "school_trip" && match.childName) vals.childName = match.childName;
    if (match.classified?.title) vals.title = match.classified.title;
    if (match.classified?.dueDate) vals.dueDate = match.classified.dueDate;
    if (match.raw && schemaIdNeedsTitle(match.schemaId)) vals.title = match.raw;
    return vals;
  }

  function schemaIdNeedsTitle(id) {
    return id === "insurance" || id === "generic";
  }

  function buildCompletionRows(result) {
    const rows = [];
    if (result.reminders) rows.push({ label: "Reminder", show: true });
    if (result.tasks) rows.push({ label: "Tasks", show: result.tasks > 0 });
    if (result.notifications) rows.push({ label: "Notifications", show: true });
    if (result.workflow) rows.push({ label: "Workflow", show: true });
    if (rows.length === 0) rows.push({ label: "Reminder", show: true });
    return rows.filter((r) => r.show);
  }

  window.LifeAdminOnboardingFields = {
    SCHEMAS,
    detectSchema,
    getSchema,
    defaultValues,
    buildCompletionRows,
  };
})();
