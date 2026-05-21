/**
 * Life Admin — workflow templates for life events v1
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
      taskCreated: false,
      reminderCreated: false,
    };
  }

  const WORKFLOWS = Object.freeze({
    moving_house: {
      id: "moving_house",
      title: "Moving House",
      icon: "🏠",
      description: "Utilities, post, movers, insurance, and address updates.",
      defaultTargetDays: 30,
      checklist: [
        item("notify_utilities", "Notify utilities", { dueOffsetDays: -28, estMinutes: 45 }),
        item("update_address", "Update address with bank & GP", { dueOffsetDays: -21, estMinutes: 60 }),
        item("redirect_mail", "Redirect mail with Royal Mail", { dueOffsetDays: -14, estMinutes: 20 }),
        item("book_movers", "Book movers or hire van", { dueOffsetDays: -21, estMinutes: 40 }),
        item("update_insurance", "Update home contents insurance", {
          dueOffsetDays: -14,
          estMinutes: 45,
          reminderCategory: "bills",
        }),
        item("pack_belongings", "Pack belongings room by room", { dueOffsetDays: -7, estMinutes: 240 }),
        item("read_meters", "Read meters on moving day", { dueOffsetDays: 0, estMinutes: 15 }),
        item("council_tax", "Council tax transfer", { dueOffsetDays: -10, estMinutes: 30 }),
      ],
      timeline: [
        item("tl_book_movers", "Book movers confirmed", { kind: "timeline", dueOffsetDays: -21 }),
        item("tl_utilities", "Utilities switchover date", { kind: "timeline", dueOffsetDays: -7 }),
        item("tl_move_day", "Moving day", { kind: "timeline", dueOffsetDays: 0 }),
        item("tl_redirect", "Mail redirect starts", { kind: "timeline", dueOffsetDays: 0 }),
      ],
      tasks: [
        item("task_inventory", "Create home inventory for insurance", {
          kind: "task",
          dueOffsetDays: -14,
          priority: "medium",
          category: "documents",
        }),
        item("task_school", "Check school catchment / transfers", {
          kind: "task",
          dueOffsetDays: -30,
          priority: "high",
          category: "family",
        }),
      ],
      documents: [
        item("doc_lease", "Tenancy agreement or sale contract", { kind: "document", hint: "Store in Vault" }),
        item("doc_inventory", "Mover quote & insurance certificate", { kind: "document" }),
        item("doc_id", "ID for utility credit checks", { kind: "document" }),
      ],
      reminders: [
        item("rem_utilities", "Final meter readings", {
          kind: "reminder",
          dueOffsetDays: 0,
          reminderCategory: "bills",
        }),
      ],
    },

    new_job: {
      id: "new_job",
      title: "New Job",
      icon: "💼",
      description: "Contracts, payroll, benefits, and first-week setup.",
      defaultTargetDays: 14,
      checklist: [
        item("sign_contract", "Sign contract & return", { dueOffsetDays: -14, estMinutes: 30 }),
        item("p45_p60", "Share P45 / tax details with payroll", { dueOffsetDays: -10, estMinutes: 20 }),
        item("bank_payroll", "Set up payroll bank details", { dueOffsetDays: -7, estMinutes: 15 }),
        item("pension", "Choose pension contribution", { dueOffsetDays: -7, estMinutes: 25 }),
        item("it_setup", "Laptop & accounts setup", { dueOffsetDays: -3, estMinutes: 60 }),
        item("commute_plan", "Plan commute or WFH setup", { dueOffsetDays: -5, estMinutes: 30 }),
        item("notice_old", "Confirm notice period with current employer", { dueOffsetDays: -21, estMinutes: 20 }),
      ],
      timeline: [
        item("tl_offer", "Offer accepted", { kind: "timeline", dueOffsetDays: -21 }),
        item("tl_start", "First day", { kind: "timeline", dueOffsetDays: 0 }),
        item("tl_probation", "Probation review scheduled", { kind: "timeline", dueOffsetDays: 90 }),
      ],
      tasks: [
        item("task_benefits", "Review health & benefits enrolment", { kind: "task", dueOffsetDays: -5, category: "general" }),
        item("task_intro", "Prepare 30-second intro for team", { kind: "task", dueOffsetDays: -2, category: "general" }),
      ],
      documents: [
        item("doc_contract", "Employment contract", { kind: "document" }),
        item("doc_handbook", "Employee handbook", { kind: "document" }),
      ],
      reminders: [],
    },

    holiday_planning: {
      id: "holiday_planning",
      title: "Holiday Planning",
      icon: "✈",
      description: "Travel docs, insurance, pet care, and home security.",
      defaultTargetDays: 45,
      checklist: [
        item("passport_check", "Check passport validity (6+ months)", { dueOffsetDays: -60, estMinutes: 10 }),
        item("book_travel", "Book flights or transport", { dueOffsetDays: -45, estMinutes: 60 }),
        item("travel_insurance", "Buy travel insurance", { dueOffsetDays: -30, estMinutes: 30 }),
        item("pet_care", "Arrange pet care or kennels", { dueOffsetDays: -21, estMinutes: 25 }),
        item("home_security", "Set lights / neighbour check", { dueOffsetDays: -3, estMinutes: 20 }),
        item("pack_list", "Pack & share itinerary with family", { dueOffsetDays: -5, estMinutes: 45 }),
        item("currency", "Order currency or travel card", { dueOffsetDays: -10, estMinutes: 15 }),
      ],
      timeline: [
        item("tl_depart", "Departure day", { kind: "timeline", dueOffsetDays: 0 }),
        item("tl_return", "Return home", { kind: "timeline", dueOffsetDays: 14 }),
      ],
      tasks: [
        item("task_out_of_office", "Set out-of-office & handover", { kind: "task", dueOffsetDays: -7, category: "general" }),
      ],
      documents: [
        item("doc_passport", "Passport copies in Vault", { kind: "document" }),
        item("doc_insurance", "Travel insurance policy", { kind: "document" }),
        item("doc_tickets", "Booking confirmations", { kind: "document" }),
      ],
      reminders: [
        item("rem_passport", "Passport expiry check", { kind: "reminder", dueOffsetDays: -60, reminderCategory: "passport" }),
      ],
    },

    starting_university: {
      id: "starting_university",
      title: "Starting University",
      icon: "🎓",
      description: "Accommodation, finance, enrolment, and student essentials.",
      defaultTargetDays: 30,
      checklist: [
        item("accept_offer", "Accept offer & confirm place", { dueOffsetDays: -90, estMinutes: 30 }),
        item("student_finance", "Apply for student finance", { dueOffsetDays: -60, estMinutes: 90 }),
        item("accommodation", "Confirm halls or housing", { dueOffsetDays: -45, estMinutes: 60 }),
        item("gp_register", "Register with GP near campus", { dueOffsetDays: -14, estMinutes: 25 }),
        item("bank_student", "Open student bank account", { dueOffsetDays: -30, estMinutes: 45 }),
        item("pack_uni", "Pack essentials & documents folder", { dueOffsetDays: -7, estMinutes: 120 }),
        item("transport_pass", "Railcard or bus pass", { dueOffsetDays: -5, estMinutes: 20 }),
      ],
      timeline: [
        item("tl_enrol", "Enrolment day", { kind: "timeline", dueOffsetDays: -7 }),
        item("tl_move_in", "Move into accommodation", { kind: "timeline", dueOffsetDays: -3 }),
        item("tl_freshers", "Freshers week starts", { kind: "timeline", dueOffsetDays: 0 }),
      ],
      tasks: [
        item("task_modules", "Review module choices", { kind: "task", dueOffsetDays: -14, category: "general" }),
      ],
      documents: [
        item("doc_ucas", "UCAS / offer letter", { kind: "document" }),
        item("doc_finance", "Student finance entitlement letter", { kind: "document" }),
      ],
      reminders: [],
    },

    pregnancy: {
      id: "pregnancy",
      title: "Pregnancy",
      icon: "🤰",
      description: "Appointments, maternity leave, benefits, and nursery planning.",
      defaultTargetDays: 180,
      checklist: [
        item("midwife_book", "Book midwife / first appointment", { dueOffsetDays: -240, estMinutes: 30 }),
        item("maternity_leave", "Notify employer & plan leave dates", { dueOffsetDays: -120, estMinutes: 45 }),
        item("maternity_pay", "Check statutory maternity pay", { dueOffsetDays: -90, estMinutes: 40 }),
        item("nursery_research", "Research nurseries or childcare", { dueOffsetDays: -60, estMinutes: 60 }),
        item("hospital_bag", "Pack hospital bag", { dueOffsetDays: -14, estMinutes: 90 }),
        item("birth_plan", "Draft birth plan with partner", { dueOffsetDays: -30, estMinutes: 45 }),
        item("mat_b1", "Claim maternity allowance / benefits", { dueOffsetDays: -60, estMinutes: 50 }),
      ],
      timeline: [
        item("tl_12week", "12-week scan", { kind: "timeline", dueOffsetDays: -180 }),
        item("tl_20week", "20-week scan", { kind: "timeline", dueOffsetDays: -120 }),
        item("tl_due", "Due date", { kind: "timeline", dueOffsetDays: 0 }),
      ],
      tasks: [
        item("task_baby_budget", "Update household budget for baby", { kind: "task", dueOffsetDays: -90, category: "family" }),
      ],
      documents: [
        item("doc_mat_notes", "Maternity notes / green book", { kind: "document" }),
        item("doc_employer", "MAT B1 employer form", { kind: "document" }),
      ],
      reminders: [],
    },

    starting_business: {
      id: "starting_business",
      title: "Starting a Business",
      icon: "🚀",
      description: "Registration, tax, banking, and compliance basics.",
      defaultTargetDays: 60,
      checklist: [
        item("business_plan", "Draft simple business plan", { dueOffsetDays: -60, estMinutes: 180 }),
        item("register_co", "Register company or sole trader", { dueOffsetDays: -45, estMinutes: 90 }),
        item("business_bank", "Open business bank account", { dueOffsetDays: -30, estMinutes: 60 }),
        item("accountant", "Find accountant or bookkeeping tool", { dueOffsetDays: -30, estMinutes: 45 }),
        item("insurance_liab", "Professional / liability insurance", { dueOffsetDays: -21, estMinutes: 40 }),
        item("gdpr_privacy", "Privacy policy & GDPR basics", { dueOffsetDays: -14, estMinutes: 60 }),
        item("invoice_template", "Invoice & contract templates", { dueOffsetDays: -10, estMinutes: 45 }),
      ],
      timeline: [
        item("tl_launch", "Soft launch / first client", { kind: "timeline", dueOffsetDays: 0 }),
        item("tl_vat", "VAT registration threshold review", { kind: "timeline", dueOffsetDays: 90 }),
      ],
      tasks: [
        item("task_brand", "Register domain & basic brand", { kind: "task", dueOffsetDays: -40, category: "general" }),
        item("task_hmrc", "Register for Self Assessment / PAYE if needed", { kind: "task", dueOffsetDays: -35, priority: "high" }),
      ],
      documents: [
        item("doc_incorporation", "Certificate of incorporation", { kind: "document" }),
        item("doc_insurance", "Business insurance policy", { kind: "document" }),
      ],
      reminders: [
        item("rem_accounts", "First quarterly accounts reminder", { kind: "reminder", dueOffsetDays: 90, reminderCategory: "bills" }),
      ],
    },
  });

  function getWorkflow(type) {
    return WORKFLOWS[type] || null;
  }

  function listWorkflows() {
    return Object.values(WORKFLOWS);
  }

  function buildItemsFromTemplate(template, targetDateIso) {
    const base = targetDateIso
      ? new Date(targetDateIso + "T12:00:00")
      : addDays(new Date(), template.defaultTargetDays || 30);
    const groups = ["checklist", "timeline", "tasks", "documents", "reminders"];
    const items = [];
    for (const group of groups) {
      for (const t of template[group] || []) {
        const due = addDays(base, t.dueOffsetDays);
        items.push({
          ...t,
          dueDate: iso(due),
        });
      }
    }
    return items.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function iso(d) {
    return d.toISOString().slice(0, 10);
  }

  window.LifeAdminLifeEventTemplates = {
    WORKFLOWS,
    getWorkflow,
    listWorkflows,
    buildItemsFromTemplate,
  };
})();
