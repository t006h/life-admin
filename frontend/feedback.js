/**
 * Life Admin — in-app feedback (issue / feature suggestion)
 */
(function () {
  const QUEUE_KEY = "life_admin_feedback_queue";

  let els = {};
  let mode = "issue";

  function readQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeQueue(items) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)));
  }

  async function submitFeedback(type, message, email) {
    const row = {
      feedback_type: type,
      message: message.trim(),
      contact_email: email || null,
      user_id: window.LifeAdminAccess?.getUserContext?.()?.userId || null,
      created_at: new Date().toISOString(),
    };

    const q = readQueue();
    q.push(row);
    writeQueue(q);

    const client = window.supabaseClient;
    if (client) {
      const { error } = await client.from("product_feedback").insert(row);
      if (error) throw error;
    }

    window.LifeAdminProductAnalytics?.track?.("feedback_submitted", { type });
  }

  function open(type) {
    mode = type === "feature" ? "feature" : "issue";
    if (els.title) {
      els.title.textContent =
        mode === "feature" ? "Suggest a feature" : "Report an issue";
    }
    if (els.message) els.message.value = "";
    if (els.email) {
      els.email.value = window.LifeAdminAccess?.getUserContext?.()?.email || "";
    }
    els.dialog?.showModal?.();
    setTimeout(() => els.message?.focus(), 80);
  }

  function close() {
    els.dialog?.close?.();
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const text = els.message?.value?.trim();
    if (!text) {
      window.LifeAdminProduction?.showError?.("Please describe your feedback.");
      return;
    }
    els.submitBtn.disabled = true;
    try {
      await submitFeedback(mode, text, els.email?.value?.trim());
      close();
      window.LifeAdminProduction?.showSuccess?.("Thanks — we've received your feedback.");
    } catch (err) {
      window.LifeAdminProduction?.showError?.(
        err.message || "Could not send feedback. Try again later."
      );
    } finally {
      els.submitBtn.disabled = false;
    }
  }

  function bind() {
    els.issueBtn?.addEventListener("click", () => open("issue"));
    els.featureBtn?.addEventListener("click", () => open("feature"));
    els.closeBtn?.addEventListener("click", close);
    els.cancelBtn?.addEventListener("click", close);
    els.form?.addEventListener("submit", handleSubmit);
    els.dialog?.addEventListener("click", (e) => {
      if (e.target === els.dialog) close();
    });
  }

  function init() {
    els = {
      dialog: document.getElementById("feedbackModal"),
      title: document.getElementById("feedbackModalTitle"),
      form: document.getElementById("feedbackForm"),
      message: document.getElementById("feedbackMessage"),
      email: document.getElementById("feedbackEmail"),
      issueBtn: document.getElementById("feedbackReportIssue"),
      featureBtn: document.getElementById("feedbackSuggestFeature"),
      submitBtn: document.getElementById("feedbackSubmit"),
      closeBtn: document.getElementById("feedbackClose"),
      cancelBtn: document.getElementById("feedbackCancel"),
    };
    bind();
  }

  window.LifeAdminFeedback = { init, open };
})();
