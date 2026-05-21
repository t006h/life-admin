/**
 * Life Admin — workflow blueprints for the Workflow Engine
 */
(function () {
  function item(key, title, opts = {}) {
    return {
      key,
      title,
      kind: opts.kind || "checklist",
      estMinutes: opts.estMinutes ?? 30,
      dueOffsetDays: opts.dueOffsetDays ?? 0,
      priority: opts.priority || "medium",
      category: opts.category || "general",
      reminderCategory: opts.reminderCategory || null,
      hint: opts.hint || "",
      done: false,
      synced: false,
    };
  }

  function dueFrom(baseDate, offsetDays) {
    const d = new Date(baseDate + "T12:00:00");
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function defaultTarget(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function flattenBlueprint(def, targetDate) {
    const groups = ["checklist", "timeline", "tasks", "documents", "reminders", "familyReminders"];
    const items = [];
    for (const g of groups) {
      for (const t of def[g] || []) {
        items.push({ ...t, dueDate: dueFrom(targetDate, t.dueOffsetDays) });
      }
    }
    return items.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }

  const PASSPORT_RENEWAL = {
    id: "passport_renewal",
    title: "Passport Renewal",
    icon: "🛂",
    description: "Renewal checklist, documents, and reminders.",
    defaultTargetDays: 90,
    effortLabel: "moderate",
    checklist: [
      item("check_validity", "Check passport validity (6+ months rule)", { dueOffsetDays: -90, estMinutes: 15 }),
      item("gather_photos", "Get compliant passport photos", { dueOffsetDays: -75, estMinutes: 45 }),
      item("complete_form", "Complete online renewal form", { dueOffsetDays: -60, estMinutes: 60 }),
      item("upload_docs", "Upload supporting documents", { dueOffsetDays: -45, estMinutes: 30, kind: "checklist" }),
      item("pay_fee", "Pay renewal fee", { dueOffsetDays: -40, estMinutes: 20 }),
      item("track_status", "Track application status", { dueOffsetDays: -14, estMinutes: 15 }),
    ],
    timeline: [
      item("tl_apply", "Application submitted", { kind: "timeline", dueOffsetDays: -40 }),
      item("tl_receive", "New passport arrives", { kind: "timeline", dueOffsetDays: 0 }),
    ],
    tasks: [
      item("task_photos", "Book photo appointment if needed", { kind: "task", dueOffsetDays: -80 }),
    ],
    documents: [
      item("doc_old", "Current passport scan", { kind: "document", hint: "Store in Vault" }),
      item("doc_photos", "Photo code / confirmation", { kind: "document" }),
    ],
    reminders: [
      item("rem_expiry", "Passport expiry", {
        kind: "reminder",
        reminderCategory: "passport",
        dueOffsetDays: 0,
        title: "Passport renewal due",
      }),
    ],
    forgetting: [],
  };

  const BUY_CAR = {
    id: "buy_car",
    title: "Buy a Car",
    icon: "🚗",
    description: "Research, finance, insurance, and registration.",
    defaultTargetDays: 45,
    effortLabel: "significant",
    checklist: [
      item("budget", "Set budget and must-haves", { dueOffsetDays: -40, estMinutes: 60 }),
      item("research", "Research models and running costs", { dueOffsetDays: -35, estMinutes: 120 }),
      item("insurance_quotes", "Get insurance quotes", { dueOffsetDays: -21, estMinutes: 45 }),
      item("test_drive", "Book test drives", { dueOffsetDays: -28, estMinutes: 90 }),
      item("finance", "Arrange finance or payment", { dueOffsetDays: -14, estMinutes: 60 }),
      item("register", "Register vehicle and tax", { dueOffsetDays: 0, estMinutes: 45 }),
    ],
    timeline: [
      item("tl_shortlist", "Shortlist chosen", { kind: "timeline", dueOffsetDays: -21 }),
      item("tl_buy", "Purchase / collect car", { kind: "timeline", dueOffsetDays: 0 }),
    ],
    tasks: [
      item("task_mot", "Book MOT if used car", { kind: "task", category: "mot", dueOffsetDays: -7, priority: "high" }),
    ],
    documents: [
      item("doc_v5", "V5C / registration docs", { kind: "document" }),
      item("doc_insurance", "Insurance certificate", { kind: "document" }),
    ],
    reminders: [
      item("rem_mot", "First MOT reminder", { kind: "reminder", reminderCategory: "mot", dueOffsetDays: 365, title: "Car MOT" }),
    ],
    forgetting: [
      { text: "Breakdown cover", sub: "Often forgotten until first long trip" },
      { text: "Update address on licence", sub: "DVLA when you move registration" },
      { text: "Parking permit at home", sub: "Council or estate rules" },
    ],
  };

  const SCHOOL_TRIP = {
    id: "school_trip",
    title: "School Trip",
    icon: "📄",
    description: "Forms, payments, and packing for the trip.",
    defaultTargetDays: 14,
    effortLabel: "light",
    checklist: [
      item("form", "Complete permission form", { dueOffsetDays: -10, estMinutes: 20 }),
      item("payment", "Pay trip contribution", { dueOffsetDays: -7, estMinutes: 15 }),
      item("pack", "Pack lunch and kit list", { dueOffsetDays: -1, estMinutes: 30 }),
    ],
    timeline: [
      item("tl_deadline", "Form deadline", { kind: "timeline", dueOffsetDays: -7 }),
      item("tl_trip", "Trip day", { kind: "timeline", dueOffsetDays: 0 }),
    ],
    tasks: [],
    familyReminders: [],
    forgetting: [
      { text: "Notify school", sub: "Allergies or medical info updates" },
      { text: "Emergency contact details", sub: "Double-check form" },
    ],
  };

  const DENTIST = {
    id: "dentist_appointment",
    title: "Dentist Appointment",
    icon: "🩺",
    description: "Book, attend, and follow up.",
    defaultTargetDays: 14,
    effortLabel: "light",
    checklist: [
      item("book", "Book dentist appointment", { dueOffsetDays: -10, estMinutes: 15 }),
      item("attend", "Attend appointment", { dueOffsetDays: 0, estMinutes: 60 }),
    ],
    timeline: [item("tl_appt", "Appointment", { kind: "timeline", dueOffsetDays: 0 })],
    tasks: [item("task_book", "Book dentist", { kind: "task", dueOffsetDays: -10 })],
    calendarBlocks: [
      {
        title: "Dentist appointment",
        startTime: "09:00:00",
        endTime: "10:00:00",
        dueOffsetDays: 0,
        category: "family",
      },
    ],
    forgetting: [{ text: "Check NHS vs private cover", sub: "Costs and waiting times" }],
  };

  function lifeEventBlueprint(type) {
    const t = window.LifeAdminLifeEventTemplates?.getWorkflow?.(type);
    if (!t) return null;
    const effort =
      type === "moving_house"
        ? "significant"
        : type === "pregnancy"
          ? "long-term"
          : "moderate";
    return { ...t, effortLabel: effort, forgetting: [] };
  }

  const LIFE_EVENT_IDS = [
    "moving_house",
    "new_job",
    "holiday_planning",
    "starting_university",
    "pregnancy",
    "starting_business",
  ];

  const BUILTIN = {
    passport_renewal: PASSPORT_RENEWAL,
    buy_car: BUY_CAR,
    school_trip: SCHOOL_TRIP,
    dentist_appointment: DENTIST,
  };

  function getBlueprint(id) {
    if (BUILTIN[id]) return BUILTIN[id];
    if (LIFE_EVENT_IDS.includes(id)) return lifeEventBlueprint(id);
    return null;
  }

  function listBlueprintIds() {
    return [...Object.keys(BUILTIN), ...LIFE_EVENT_IDS];
  }

  window.LifeAdminWorkflowDefinitions = {
    getBlueprint,
    listBlueprintIds,
    flattenBlueprint,
    defaultTarget,
    LIFE_EVENT_IDS,
  };
})();
