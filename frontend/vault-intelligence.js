/**
 * Life Admin — Document intelligence (placeholder extraction, reminders, insights)
 */
(function () {
  const INSIGHT_HORIZON_DAYS = 180;

  function getContext() {
    return window.LifeAdminAccess?.getUserContext() || {};
  }

  function iso(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(base, days) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  function addMonths(base, months) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + months);
    return d;
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

  function guessCategory(fileName, hint) {
    if (hint) return hint;
    const n = (fileName || "").toLowerCase();
    if (/passport/i.test(n)) return "passport";
    if (/insurance|policy|cover|motor|car/i.test(n)) return "insurance";
    if (/school|form|report/i.test(n)) return "school";
    if (/receipt|invoice/i.test(n)) return "receipts";
    return "other";
  }

  /**
   * Placeholder document intelligence — not real OCR.
   * Returns normalized extraction + metadata.
   */
  function extractDocument(category, fileName, hintCategory) {
    const cat = guessCategory(fileName, hintCategory || category);
    const ctx = getContext();
    const first = ctx.fullName?.split(/\s+/)[0] || "Family member";
    const today = new Date();

    if (cat === "passport" || /passport/i.test(fileName || "")) {
      const expiry = addMonths(today, 5);
      return {
        category: "passport",
        data: {
          name: ctx.fullName || first,
          passport_number: "12AB34567",
          expiry_date: iso(expiry),
          _intelligence: "passport",
          _placeholder: true,
          _message: "Passport detected (placeholder extraction)",
        },
      };
    }

    if (cat === "insurance" || /insurance|policy|motor|car/i.test(fileName || "")) {
      const renewal = addDays(today, 28);
      const provider = /car|motor/i.test(fileName || "")
        ? "Car insurance"
        : "Example Insurance Ltd";
      return {
        category: "insurance",
        data: {
          provider,
          policy_number: "POL-88421",
          renewal_date: iso(renewal),
          _intelligence: "insurance",
          _placeholder: true,
          _message: "Insurance policy detected (placeholder extraction)",
        },
      };
    }

    if (cat === "school" || /school|form/i.test(fileName || "")) {
      const due = addDays(today, 12);
      return {
        category: "school",
        data: {
          child_name: "Emma",
          due_date: iso(due),
          form_title: "School permission form",
          _intelligence: "school",
          _placeholder: true,
          _message: "School form detected (placeholder extraction)",
        },
      };
    }

    if (cat === "receipts" || /receipt|invoice/i.test(fileName || "")) {
      const purchased = addDays(today, -3);
      return {
        category: "receipts",
        data: {
          merchant: "John Lewis",
          amount: 89.99,
          purchase_date: iso(purchased),
          _intelligence: "receipts",
          _placeholder: true,
          _message: "Receipt detected (placeholder extraction)",
        },
      };
    }

    return {
      category: cat,
      data: {
        _intelligence: "generic",
        _placeholder: true,
        _message: "Document saved — add expiry to enable reminders",
      },
    };
  }

  function dueDateFromExtracted(category, data) {
    if (!data) return "";
    if (data.expiry_date) return data.expiry_date;
    if (data.renewal_date) return data.renewal_date;
    if (data.due_date) return data.due_date;
    return "";
  }

  function titleFromExtracted(category, data, fileName) {
    if (category === "passport" && data.name) return `${data.name.split(/\s+/)[0]} — Passport`;
    if (category === "insurance" && data.provider) return `${data.provider}`;
    if (category === "school" && data.child_name) {
      return data.form_title || `School form — ${data.child_name}`;
    }
    if (category === "receipts" && data.merchant) return `${data.merchant} receipt`;
    return fileName?.replace(/\.[^.]+$/, "") || "Untitled document";
  }

  function previewLines(data) {
    const lines = [];
    if (data.name) lines.push({ label: "Name", value: data.name });
    if (data.passport_number) lines.push({ label: "Passport number", value: data.passport_number });
    if (data.expiry_date) lines.push({ label: "Expiry date", value: data.expiry_date });
    if (data.provider) lines.push({ label: "Provider", value: data.provider });
    if (data.policy_number) lines.push({ label: "Policy", value: data.policy_number });
    if (data.renewal_date) lines.push({ label: "Renewal date", value: data.renewal_date });
    if (data.child_name) lines.push({ label: "Child", value: data.child_name });
    if (data.due_date) lines.push({ label: "Due date", value: data.due_date });
    if (data.merchant) lines.push({ label: "Merchant", value: data.merchant });
    if (data.amount != null) lines.push({ label: "Amount", value: `£${Number(data.amount).toFixed(2)}` });
    if (data.purchase_date) lines.push({ label: "Purchase date", value: data.purchase_date });
    return lines;
  }

  /** Map vault document → life_admin_items reminder spec */
  function buildReminderSpec(doc) {
    const data = doc.extractedData || {};
    const due = doc.expiryDate || dueDateFromExtracted(doc.category, data);
    if (!due) return null;

    const linkedId = doc.linkedReminderId || data._linked_reminder_id;

    if (doc.category === "passport") {
      return {
        reminderCategory: "passport",
        item: {
          id: linkedId,
          title: data.name?.split(/\s+/)[0] || doc.title,
          subtitle: data.passport_number || "",
          dueDate: due,
          amount: null,
          frequency: "yearly",
          notes: `Auto-created from vault · ${doc.title}`,
          vaultDocumentId: doc.id,
        },
      };
    }

    if (doc.category === "insurance") {
      return {
        reminderCategory: "bills",
        item: {
          id: linkedId,
          title: data.provider || doc.title,
          subtitle: data.policy_number ? `Policy ${data.policy_number}` : "Insurance renewal",
          dueDate: due,
          amount: null,
          frequency: "yearly",
          notes: `Auto-created from vault · insurance renewal`,
          vaultDocumentId: doc.id,
        },
      };
    }

    if (doc.category === "school") {
      return {
        reminderCategory: "bills",
        item: {
          id: linkedId,
          title: data.form_title || "School form",
          subtitle: data.child_name ? `For ${data.child_name}` : "",
          dueDate: due,
          amount: null,
          frequency: "once",
          notes: `Auto-created from vault · school form`,
          vaultDocumentId: doc.id,
        },
      };
    }

    if (doc.category === "receipts") {
      return {
        reminderCategory: "subscriptions",
        item: {
          id: linkedId,
          title: data.merchant || doc.title,
          subtitle: "Receipt on file",
          dueDate: due,
          amount: data.amount != null ? Number(data.amount) : null,
          frequency: "once",
          notes: `Auto-created from vault · receipt`,
          vaultDocumentId: doc.id,
        },
      };
    }

    return null;
  }

  function insightFromDocument(doc) {
    const due = doc.expiryDate;
    if (!due) return null;
    const days = daysUntil(due);
    if (days == null || days > INSIGHT_HORIZON_DAYS) return null;

    const data = doc.extractedData || {};
    let title = "";
    let sub = doc.title;

    if (doc.category === "passport") {
      if (days < 0) title = "⚠ Passport expired";
      else title = `⚠ Passport expires in ${formatMonths(days)}`;
      sub = data.name ? `${data.name.split(/\s+/)[0]} · ${sub}` : sub;
    } else if (doc.category === "insurance") {
      const label = /car|motor/i.test(data.provider || doc.title) ? "Car insurance" : "Insurance";
      if (days < 0) title = `⚠ ${label} renewal overdue`;
      else if (days <= 45) title = `⚠ ${label} renews in ${days} days`;
      else title = `⚠ ${label} renews in ${formatMonths(days)}`;
      sub = data.provider || sub;
    } else if (doc.category === "school") {
      if (days < 0) title = "⚠ School form overdue";
      else if (days <= 7) title = `⚠ School form due in ${days} days`;
      else title = `⚠ School form due in ${formatMonths(days)}`;
      sub = data.child_name ? `For ${data.child_name}` : sub;
    } else if (days <= 90) {
      title = `⚠ ${doc.title} — ${days} days left`;
    } else {
      return null;
    }

    return {
      title,
      sub,
      icon: "⚠",
      kind: "vault",
      vaultDocId: doc.id,
      sort: days,
    };
  }

  function generateVaultInsights(documents) {
    return documents
      .map(insightFromDocument)
      .filter(Boolean)
      .sort((a, b) => a.sort - b.sort);
  }

  function getDocumentsForToday(documents, limit = 5) {
    return documents
      .filter((doc) => {
        const days = daysUntil(doc.expiryDate);
        return days != null && days <= INSIGHT_HORIZON_DAYS;
      })
      .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))
      .slice(0, limit)
      .map((doc) => {
        const cat = window.LifeAdminVault?.CATEGORIES?.[doc.category];
        const days = daysUntil(doc.expiryDate);
        let status = "ok";
        if (days < 0) status = "overdue";
        else if (days <= 30) status = "soon";
        else if (days <= 180) status = "upcoming";
        return {
          id: doc.id,
          title: doc.title,
          category: doc.category,
          categoryLabel: cat?.label || doc.category,
          icon: cat?.icon || "📁",
          expiryDate: doc.expiryDate,
          days,
          status,
          alertLine: insightFromDocument(doc)?.title || "",
          linkedReminderId: doc.linkedReminderId,
        };
      });
  }

  async function syncRemindersForDocument(doc, options = {}) {
    const spec = buildReminderSpec(doc);
    if (!spec) return { reminderId: null, skipped: "no_due_date" };

    const Reminders = window.LifeAdminReminders;
    if (!Reminders?.upsertFromVault) {
      console.warn("Vault intelligence: reminder bridge not ready");
      return { reminderId: null, skipped: "no_bridge" };
    }

    try {
      const reminderId = await Reminders.upsertFromVault({
        docId: doc.id,
        reminderCategory: spec.reminderCategory,
        item: spec.item,
      });
      return { reminderId, skipped: null };
    } catch (err) {
      if (!options.silent) console.warn("Vault reminder sync failed:", err.message);
      return { reminderId: null, skipped: err.message };
    }
  }

  function applyIntelligenceToDoc(doc, extracted, category) {
    const expiryDate = dueDateFromExtracted(category, extracted) || doc.expiryDate || "";
    return {
      ...doc,
      category,
      expiryDate,
      extractedData: { ...extracted, _linked_reminder_id: doc.linkedReminderId || extracted._linked_reminder_id },
      title: titleFromExtracted(category, extracted, doc.title) || doc.title,
    };
  }

  window.LifeAdminVaultIntelligence = {
    extractDocument,
    guessCategory,
    dueDateFromExtracted,
    titleFromExtracted,
    previewLines,
    buildReminderSpec,
    generateVaultInsights,
    getDocumentsForToday,
    syncRemindersForDocument,
    applyIntelligenceToDoc,
    insightFromDocument,
    daysUntil,
    formatMonths,
  };
})();
