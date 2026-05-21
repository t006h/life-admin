/**
 * Life Admin — Family document vault (search, filters, placeholder OCR, expiry alerts)
 */
(function () {
  const TABLE = "life_admin_vault_documents";
  const STORAGE_BUCKET = "vault-documents";
  const LS_KEY = "life_admin_vault_documents";

  const CATEGORIES = Object.freeze({
    passport: { label: "Passports", icon: "🛂", filter: "Passports" },
    insurance: { label: "Insurance", icon: "🛡️", filter: "Insurance" },
    school: { label: "School", icon: "📄", filter: "School" },
    receipts: { label: "Receipts", icon: "🧾", filter: "Receipts" },
    warranties: { label: "Warranties", icon: "📋", filter: "Warranties" },
    property: { label: "Property", icon: "🏠", filter: "Property" },
    other: { label: "Other", icon: "📁", filter: "Other" },
  });

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "passport", label: "Passports" },
    { id: "insurance", label: "Insurance" },
    { id: "school", label: "School" },
    { id: "receipts", label: "Receipts" },
    { id: "warranties", label: "Warranties" },
    { id: "property", label: "Property" },
  ];

  let documents = [];
  let activeFilter = "all";
  let searchQuery = "";
  let els = {};
  let useLocalFallback = false;

  function getClient() {
    return window.supabaseClient;
  }

  function rowToDoc(row) {
    const extracted = row.extracted_data || {};
    return {
      id: row.id,
      title: row.title || "",
      category: row.category || "other",
      expiryDate: row.expiry_date || "",
      reminderStatus: row.reminder_status || "none",
      storagePath: row.storage_path || "",
      source: row.source || "manual",
      extractedData: extracted,
      linkedReminderId: row.linked_reminder_id || extracted._linked_reminder_id || null,
      notes: row.notes || "",
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    };
  }

  function docToRow(doc) {
    const extracted = { ...(doc.extractedData || {}) };
    if (doc.linkedReminderId) extracted._linked_reminder_id = doc.linkedReminderId;
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      expiry_date: doc.expiryDate || null,
      reminder_status: doc.reminderStatus,
      storage_path: doc.storagePath || null,
      source: doc.source,
      extracted_data: extracted,
      linked_reminder_id: doc.linkedReminderId || null,
      notes: doc.notes || "",
      updated_at: new Date().toISOString(),
    };
  }

  function loadFromLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveToLocal(docs) {
    localStorage.setItem(LS_KEY, JSON.stringify(docs));
  }

  async function loadDocuments() {
    const client = getClient();
    if (!client) {
      useLocalFallback = true;
      documents = loadFromLocal();
      return documents;
    }
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      useLocalFallback = false;
      documents = (data || []).map(rowToDoc);
      return documents;
    } catch (err) {
      console.warn("Vault: using local fallback", err.message);
      useLocalFallback = true;
      documents = loadFromLocal();
      return documents;
    }
  }

  async function persistDocument(doc) {
    if (useLocalFallback) {
      const idx = documents.findIndex((d) => d.id === doc.id);
      if (idx >= 0) documents[idx] = doc;
      else documents.unshift(doc);
      saveToLocal(documents);
      return doc;
    }
    const client = getClient();
    let row = docToRow(doc);
    let { error } = await client.from(TABLE).upsert(row);
    if (error && /linked_reminder_id/.test(error.message || "")) {
      delete row.linked_reminder_id;
      ({ error } = await client.from(TABLE).upsert(row));
    }
    if (error) throw error;
    return doc;
  }

  async function removeDocument(id) {
    if (useLocalFallback) {
      documents = documents.filter((d) => d.id !== id);
      saveToLocal(documents);
      return;
    }
    const client = getClient();
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error) throw error;
    documents = documents.filter((d) => d.id !== id);
  }

  /** Placeholder storage — path only; bucket may not exist yet */
  async function placeholderStorageUpload(file, docId) {
    const path = `${STORAGE_BUCKET}/${docId}/${file.name}`;
    const client = getClient();
    if (!client || !file) return path;
    try {
      const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
        upsert: true,
      });
      if (error) console.warn("Vault storage (placeholder):", error.message);
    } catch (e) {
      console.warn("Vault storage skipped:", e.message);
    }
    return path;
  }

  function guessCategory(fileName, hint) {
    if (hint && CATEGORIES[hint]) return hint;
    const n = (fileName || "").toLowerCase();
    if (/passport/i.test(n)) return "passport";
    if (/insurance|policy|cover/i.test(n)) return "insurance";
    if (/school|form|report/i.test(n)) return "school";
    if (/receipt|invoice/i.test(n)) return "receipts";
    if (/warrant/i.test(n)) return "warranties";
    if (/property|deed|lease|mortgage/i.test(n)) return "property";
    return "other";
  }

  const Intel = () => window.LifeAdminVaultIntelligence;

  function isoFromExtracted(data) {
    return Intel()?.dueDateFromExtracted(null, data) || "";
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

  function computeReminderStatus(expiryDate) {
    const days = daysUntil(expiryDate);
    if (days == null) return { status: "none", label: "No expiry set", alert: false };
    if (days < 0) return { status: "expired", label: "Expired", alert: true };
    if (days <= 30) return { status: "alert", label: `Expires in ${days} days`, alert: true };
    if (days <= 180) {
      return {
        status: "alert",
        label: `Expires in ${formatMonths(days)}`,
        alert: true,
        warning: `⚠ ${CATEGORIES.passport?.label?.slice(0, -1) || "Document"} expires in ${formatMonths(days)}`,
      };
    }
    return { status: "scheduled", label: "Reminder scheduled", alert: false };
  }

  function expiryAlertLine(doc) {
    if (!doc.expiryDate) return "";
    const cat = CATEGORIES[doc.category] || CATEGORIES.other;
    const days = daysUntil(doc.expiryDate);
    if (days == null) return "";
    if (days < 0) return `⚠ ${doc.title} — expired`;
    if (days <= 180) {
      const label =
        doc.category === "passport"
          ? "Passport"
          : doc.category === "insurance"
            ? "Insurance"
            : cat.label.replace(/s$/, "");
      return `⚠ ${label} expires in ${formatMonths(days)}`;
    }
    return "";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatRelativeUpdated(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    const diff = Math.round((Date.now() - d) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff} days ago`;
    return formatDate(iso.slice(0, 10));
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function filteredDocuments() {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (activeFilter !== "all" && doc.category !== activeFilter) return false;
      if (!q) return true;
      const blob = [
        doc.title,
        doc.category,
        doc.notes,
        JSON.stringify(doc.extractedData),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }

  function renderFilterChips() {
    if (!els.vaultFilters) return;
    els.vaultFilters.replaceChildren();
    for (const f of FILTERS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `vault-chip${activeFilter === f.id ? " vault-chip--active" : ""}`;
      btn.textContent = f.label;
      btn.dataset.filter = f.id;
      btn.addEventListener("click", () => {
        activeFilter = f.id;
        renderFilterChips();
        renderDocumentList();
      });
      els.vaultFilters.appendChild(btn);
    }
  }

  function renderDocumentCard(doc) {
    const cat = CATEGORIES[doc.category] || CATEGORIES.other;
    const reminder = computeReminderStatus(doc.expiryDate);
    const alertLine = expiryAlertLine(doc);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vault-doc-card${reminder.alert ? " vault-doc-card--alert" : ""}`;
    btn.innerHTML = `
      <span class="vault-doc-card__icon" aria-hidden="true">${cat.icon}</span>
      <span class="vault-doc-card__body">
        <span class="vault-doc-card__title">${escape(doc.title)}</span>
        <span class="vault-doc-card__meta">${escape(cat.label)}</span>
        <span class="vault-doc-card__row">
          <span class="vault-doc-card__label">Expires</span>
          <span class="vault-doc-card__value">${escape(formatDate(doc.expiryDate))}</span>
        </span>
        <span class="vault-doc-card__row">
          <span class="vault-doc-card__label">Reminder</span>
          <span class="vault-doc-card__value vault-doc-card__value--${reminder.status}">${escape(reminder.label)}</span>
        </span>
        ${alertLine ? `<span class="vault-doc-card__alert">${escape(alertLine)}</span>` : ""}
        <span class="vault-doc-card__updated">Updated ${escape(formatRelativeUpdated(doc.updatedAt))}</span>
      </span>
      <span class="vault-doc-card__chev" aria-hidden="true">›</span>`;
    btn.addEventListener("click", () => openDetailModal(doc));
    return btn;
  }

  function renderExpiryStrip() {
    const strip = document.getElementById("vaultExpiryStrip");
    const listEl = document.getElementById("vaultExpiryList");
    if (!strip || !listEl) return;

    const expiring = documents
      .filter((d) => {
        if (!d.expiryDate) return false;
        const days = daysUntilExpiry(d.expiryDate);
        return days != null && days <= 90;
      })
      .sort((a, b) => daysUntilExpiry(a.expiryDate) - daysUntilExpiry(b.expiryDate))
      .slice(0, window.LifeAdminOS?.LIST_CAP || 5);

    listEl.replaceChildren();
    if (!expiring.length) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    expiring.forEach((doc) => {
      const li = document.createElement("li");
      const days = daysUntilExpiry(doc.expiryDate);
      li.className = "vault-expiry-item";
      li.textContent = `${doc.title} — ${days <= 0 ? "expired" : `${days} days`}`;
      listEl.appendChild(li);
    });
  }

  function daysUntilExpiry(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + "T12:00:00");
    due.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function renderDocumentList() {
    if (!els.vaultDocList) return;
    const list = filteredDocuments();
    els.vaultDocList.replaceChildren();
    renderExpiryStrip();

    if (list.length === 0) {
      els.vaultEmpty.hidden = false;
      els.vaultEmpty.textContent = searchQuery || activeFilter !== "all"
        ? "No documents match your search."
        : "Your vault is empty. Tap + to add a document.";
      return;
    }
    els.vaultEmpty.hidden = true;
    for (const doc of list) {
      const wrap = document.createElement("div");
      wrap.className = "vault-doc-card-wrap";
      wrap.dataset.vaultDoc = doc.id;
      wrap.appendChild(renderDocumentCard(doc));
      els.vaultDocList.appendChild(wrap);
    }
  }

  function renderVault() {
    renderFilterChips();
    renderDocumentList();
  }

  function setVaultFabOpen(open) {
    if (!els.vaultFabMenu || !els.vaultFabAdd) return;
    els.vaultFabMenu.classList.toggle("is-open", open);
    els.vaultFabMenu.hidden = !open;
    els.vaultFabMenu.setAttribute("aria-hidden", open ? "false" : "true");
    els.vaultFabAdd.classList.toggle("is-open", open);
    els.vaultFabAdd.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function showOcrPreview(extracted, category, fileName, source) {
    els.ocrPreview.hidden = false;
    els.ocrPreviewTitle.textContent =
      extracted._message || "Extracted details (placeholder intelligence)";
    const preview = Intel()?.previewLines(extracted) || [];
    els.ocrPreviewBody.innerHTML =
      preview.length > 0
        ? preview
            .map(
              (l) =>
                `<p><strong>${escape(l.label)}</strong> ${escape(
                  /date/i.test(l.label) ? formatDate(l.value) : String(l.value)
                )}</p>`
            )
            .join("")
        : "<p>Review and edit before saving. A reminder will be created if a date is found.</p>";

    els.vaultScanForm.dataset.pendingCategory = category;
    els.vaultScanForm.dataset.pendingSource = source;
    els.vaultScanForm.dataset.pendingFileName = fileName || "document";
    els.vaultScanForm.dataset.pendingExtracted = JSON.stringify(extracted);
  }

  async function finalizeDocument(doc) {
    const reminder = computeReminderStatus(doc.expiryDate);
    doc.reminderStatus =
      doc.expiryDate && reminder.status !== "none" ? reminder.status : doc.reminderStatus;

    await persistDocument(doc);
    const idx = documents.findIndex((d) => d.id === doc.id);
    if (idx >= 0) documents[idx] = doc;
    else documents.unshift(doc);

    const { reminderId } = await Intel()?.syncRemindersForDocument(doc, { silent: true });
    if (reminderId && reminderId !== doc.linkedReminderId) {
      doc.linkedReminderId = reminderId;
      doc.extractedData = { ...doc.extractedData, _linked_reminder_id: reminderId };
      await persistDocument(doc);
      if (idx >= 0) documents[idx] = doc;
    }

    await window.LifeAdminReminders?.reloadReminders?.();
    renderVault();
    window.LifeAdminProductAnalytics?.trackVaultUpload?.({
      category: doc.category,
      source: doc.source || "upload",
    });
  }

  async function saveFromScanForm() {
    const category = els.vaultScanForm.dataset.pendingCategory || "other";
    const source = els.vaultScanForm.dataset.pendingSource || "scan";
    const fileName = els.vaultScanForm.dataset.pendingFileName || "Document";
    let extracted = {};
    try {
      extracted = JSON.parse(els.vaultScanForm.dataset.pendingExtracted || "{}");
    } catch {
      /* ignore */
    }

    const id = els.vaultScanForm.dataset.pendingDocId || crypto.randomUUID();
    let doc = {
      id,
      title: Intel()?.titleFromExtracted(category, extracted, fileName) || fileName,
      category,
      expiryDate: isoFromExtracted(extracted),
      reminderStatus: "scheduled",
      storagePath:
        els.vaultScanForm.dataset.pendingStoragePath ||
        `${STORAGE_BUCKET}/${id}/${fileName}`,
      source,
      extractedData: extracted,
      linkedReminderId: null,
      notes: "",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    doc = Intel()?.applyIntelligenceToDoc(doc, extracted, category) || doc;

    els.vaultScanModal.close();
    await finalizeDocument(doc);
  }

  async function saveManualForm() {
    const title = els.fieldVaultTitle.value.trim();
    if (!title) {
      alert("Enter a document name.");
      return;
    }
    const category = els.fieldVaultCategory.value;
    const expiryDate = els.fieldVaultExpiry.value;
    const reminder = computeReminderStatus(expiryDate);
    const id = els.fieldVaultId.value || crypto.randomUUID();
    const existing = documents.find((d) => d.id === id);

    let doc = {
      id,
      title,
      category,
      expiryDate,
      reminderStatus: expiryDate ? (reminder.status === "none" ? "scheduled" : reminder.status) : "none",
      storagePath: existing?.storagePath || "",
      source: existing?.source || "manual",
      extractedData: existing?.extractedData || {},
      linkedReminderId: existing?.linkedReminderId || null,
      notes: els.fieldVaultNotes.value.trim(),
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    if (expiryDate && !doc.extractedData.expiry_date && !doc.extractedData.renewal_date) {
      if (category === "passport") doc.extractedData.expiry_date = expiryDate;
      else if (category === "insurance") doc.extractedData.renewal_date = expiryDate;
      else if (category === "school") doc.extractedData.due_date = expiryDate;
    }

    els.vaultManualModal.close();
    await finalizeDocument(doc);
  }

  function openDetailModal(doc) {
    const cat = CATEGORIES[doc.category] || CATEGORIES.other;
    els.vaultDetailTitle.textContent = doc.title;
    els.vaultDetailBody.innerHTML = `
      <p><strong>Category</strong> ${escape(cat.label)}</p>
      <p><strong>Expiry</strong> ${escape(formatDate(doc.expiryDate))}</p>
      <p><strong>Reminder</strong> ${escape(computeReminderStatus(doc.expiryDate).label)}</p>
      <p><strong>Source</strong> ${escape(doc.source)}</p>
      <p><strong>Storage</strong> <code>${escape(doc.storagePath || "—")}</code></p>
      <p><strong>Last updated</strong> ${escape(formatRelativeUpdated(doc.updatedAt))}</p>
      ${doc.linkedReminderId ? `<p><strong>Reminder</strong> Linked · auto-synced</p>` : ""}
      ${Intel()?.previewLines(doc.extractedData || {}).map((l) => `<p><strong>${escape(l.label)}</strong> ${escape(String(l.value))}</p>`).join("") || ""}
      ${doc.notes ? `<p><strong>Notes</strong> ${escape(doc.notes)}</p>` : ""}`;
    els.vaultDetailEdit.dataset.docId = doc.id;
    els.vaultDetailDelete.dataset.docId = doc.id;
    els.vaultDetailModal.showModal();
  }

  function openManualModal(doc) {
    els.vaultManualTitle.textContent = doc ? "Edit document" : "Add manually";
    els.fieldVaultId.value = doc?.id || "";
    els.fieldVaultTitle.value = doc?.title || "";
    els.fieldVaultCategory.value = doc?.category || "passport";
    els.fieldVaultExpiry.value = doc?.expiryDate || "";
    els.fieldVaultNotes.value = doc?.notes || "";
    els.vaultManualModal.showModal();
    els.fieldVaultTitle.focus();
  }

  function openScanModal(source) {
    els.vaultScanTitle.textContent = source === "upload" ? "Upload document" : "Scan document";
    els.vaultScanForm.reset();
    els.ocrPreview.hidden = true;
    delete els.vaultScanForm.dataset.pendingExtracted;
    els.vaultScanForm.dataset.pendingSource = source;
    els.vaultScanFile.value = "";
    els.vaultScanModal.showModal();
  }

  async function handleFileSelected(file, source) {
    if (!file) return;
    const hint = els.fieldVaultScanCategory?.value;
    const { category, data: extracted } = Intel().extractDocument(
      hint,
      file.name,
      hint
    );
    const docId = crypto.randomUUID();
    els.vaultScanForm.dataset.pendingDocId = docId;
    const path = await placeholderStorageUpload(file, docId);
    els.vaultScanForm.dataset.pendingStoragePath = path;
    showOcrPreview(extracted, category, file.name, source);
  }

  function bindEvents() {
    els.vaultSearch?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderDocumentList();
    });

    els.vaultFabAdd?.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = els.vaultFabMenu?.classList.contains("is-open");
      setVaultFabOpen(!open);
    });

    els.vaultFabMenu?.querySelectorAll("[data-vault-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setVaultFabOpen(false);
        const action = btn.dataset.vaultAction;
        if (action === "manual") openManualModal(null);
        else openScanModal(action === "upload" ? "upload" : "scan");
      });
    });

    document.addEventListener("click", (e) => {
      if (
        els.vaultFabMenu?.classList.contains("is-open") &&
        !e.target.closest(".vault-fab-wrap")
      ) {
        setVaultFabOpen(false);
      }
    });

    els.vaultScanFile?.addEventListener("change", () => {
      const file = els.vaultScanFile.files?.[0];
      const source = els.vaultScanForm.dataset.pendingSource || "scan";
      handleFileSelected(file, source);
    });

    els.vaultScanSave?.addEventListener("click", () => saveFromScanForm());
    els.vaultScanClose?.addEventListener("click", () => els.vaultScanModal.close());
    els.vaultScanModal?.addEventListener("click", (e) => {
      if (e.target === els.vaultScanModal) els.vaultScanModal.close();
    });

    els.vaultManualForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveManualForm();
    });
    els.vaultManualClose?.addEventListener("click", () => els.vaultManualModal.close());
    els.vaultManualModal?.addEventListener("click", (e) => {
      if (e.target === els.vaultManualModal) els.vaultManualModal.close();
    });

    els.vaultDetailClose?.addEventListener("click", () => els.vaultDetailModal.close());
    els.vaultDetailEdit?.addEventListener("click", () => {
      const id = els.vaultDetailEdit.dataset.docId;
      const doc = documents.find((d) => d.id === id);
      els.vaultDetailModal.close();
      if (doc) openManualModal(doc);
    });
    els.vaultDetailDelete?.addEventListener("click", async () => {
      const id = els.vaultDetailDelete.dataset.docId;
      if (!id || !confirm("Remove this document from your vault?")) return;
      await removeDocument(id);
      els.vaultDetailModal.close();
      renderVault();
    });
  }

  async function init(dom) {
    els = {
      vaultSearch: dom.vaultSearch,
      vaultFilters: dom.vaultFilters,
      vaultDocList: dom.vaultDocList,
      vaultEmpty: dom.vaultEmpty,
      vaultFabAdd: dom.vaultFabAdd,
      vaultFabMenu: dom.vaultFabMenu,
      vaultScanModal: dom.vaultScanModal,
      vaultScanClose: dom.vaultScanClose,
      vaultScanTitle: dom.vaultScanTitle,
      vaultScanForm: dom.vaultScanForm,
      vaultScanFile: dom.vaultScanFile,
      vaultScanSave: dom.vaultScanSave,
      ocrPreview: dom.ocrPreview,
      ocrPreviewTitle: dom.ocrPreviewTitle,
      ocrPreviewBody: dom.ocrPreviewBody,
      fieldVaultScanCategory: dom.fieldVaultScanCategory,
      vaultManualModal: dom.vaultManualModal,
      vaultManualTitle: dom.vaultManualTitle,
      vaultManualClose: dom.vaultManualClose,
      vaultManualForm: dom.vaultManualForm,
      fieldVaultId: dom.fieldVaultId,
      fieldVaultTitle: dom.fieldVaultTitle,
      fieldVaultCategory: dom.fieldVaultCategory,
      fieldVaultExpiry: dom.fieldVaultExpiry,
      fieldVaultNotes: dom.fieldVaultNotes,
      vaultDetailModal: dom.vaultDetailModal,
      vaultDetailTitle: dom.vaultDetailTitle,
      vaultDetailBody: dom.vaultDetailBody,
      vaultDetailClose: dom.vaultDetailClose,
      vaultDetailEdit: dom.vaultDetailEdit,
      vaultDetailDelete: dom.vaultDetailDelete,
    };

    populateCategorySelect(els.fieldVaultCategory);
    if (els.fieldVaultScanCategory) populateCategorySelect(els.fieldVaultScanCategory);

    bindEvents();
    setVaultFabOpen(false);
    await loadDocuments();
    renderVault();
  }

  function populateCategorySelect(select) {
    if (!select) return;
    select.replaceChildren();
    for (const [value, meta] of Object.entries(CATEGORIES)) {
      if (value === "other") continue;
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = meta.label.replace(/s$/, "");
      select.appendChild(opt);
    }
    const other = document.createElement("option");
    other.value = "other";
    other.textContent = "Other";
    select.appendChild(other);
  }

  function getDocuments() {
    return documents;
  }

  window.LifeAdminVault = {
    init,
    loadDocuments,
    getDocuments,
    renderVault,
    setVaultFabOpen,
    CATEGORIES,
  };
})();
