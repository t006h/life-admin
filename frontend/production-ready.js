/**
 * Life Admin — production UX: loading, errors, empty states
 */
(function () {
  const APP_VERSION = "v0.1";

  const EMPTY_MESSAGES = Object.freeze({
    reminders: "No reminders yet",
    mot: "No reminders yet",
    passport: "No passport reminders yet",
    licence: "No licence reminders yet",
    subscriptions: "No subscriptions yet",
    bills: "No bill reminders yet",
    tasks: "No tasks yet",
    vault: "No documents in your vault yet",
    notifications: "No notifications right now",
    priorities: "Nothing urgent today — enjoy the calm",
    upcoming: "Nothing coming up in the next 7 days",
    workflows: "No active workflows",
    actions: "Nothing ready to complete",
    familyMembers: "No family members yet",
    familyReminders: "No family reminders yet",
    familyTasks: "No shared tasks yet",
    linkedDocs: "No linked documents due soon",
    default: "Nothing here yet",
  });

  const EMPTY_SELECTORS = [
    ["#motEmpty", "mot"],
    ["#passportEmpty", "passport"],
    ["#licenceEmpty", "licence"],
    ["#subscriptionsEmpty", "subscriptions"],
    ["#billsEmpty", "bills"],
    ["#tasksEmpty", "tasks"],
    ["#tasksEmptyPage", "tasks"],
    ["#vaultEmpty", "vault"],
    ["#notificationEmpty", "notifications"],
    ["#linkedDocsEmpty", "linkedDocs"],
    ["#familyMembersEmpty", "familyMembers"],
    ["#familyRemindersEmpty", "familyReminders"],
    ["#familyTasksEmpty", "familyTasks"],
  ];

  function applyEmptyStateMessages() {
    EMPTY_SELECTORS.forEach(([sel, key]) => {
      const el = document.querySelector(sel);
      if (el) {
        el.textContent = EMPTY_MESSAGES[key] || EMPTY_MESSAGES.default;
        el.classList.add("empty-line--ready");
      }
    });
  }

  function setViewLoading(viewEl, loading, label) {
    if (!viewEl) return;
    viewEl.classList.toggle("view--loading", !!loading);
    viewEl.setAttribute("aria-busy", loading ? "true" : "false");
    let overlay = viewEl.querySelector(".view-loading-overlay");
    if (loading) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "view-loading-overlay";
        overlay.setAttribute("role", "status");
        overlay.innerHTML = `<span class="view-loading-overlay__spinner" aria-hidden="true"></span>
          <span class="view-loading-overlay__text">${label || "Loading…"}</span>`;
        viewEl.appendChild(overlay);
      } else if (label) {
        const t = overlay.querySelector(".view-loading-overlay__text");
        if (t) t.textContent = label;
      }
    } else if (overlay) {
      overlay.remove();
    }
  }

  function showError(message, detail) {
    const msg = message || "Something went wrong";
    if (window.LifeAdminDeploy?.showFatalError && !window.__LIFE_ADMIN_BOOTED__) {
      window.LifeAdminDeploy.showFatalError("Life Admin", msg);
      return;
    }
    if (window.LifeAdminApp?.showError) {
      window.LifeAdminApp.showError(detail ? `${msg} — ${detail}` : msg);
      return;
    }
    const banner = document.getElementById("appBanner");
    const text = document.getElementById("appBannerText");
    if (banner && text) {
      banner.hidden = false;
      banner.className = "app-banner app-banner--error";
      text.textContent = msg;
    }
  }

  function showSuccess(message) {
    if (window.LifeAdminApp?.showError) {
      const banner = document.getElementById("appBanner");
      const text = document.getElementById("appBannerText");
      if (banner && text) {
        banner.hidden = false;
        banner.className = "app-banner app-banner--loading";
        text.textContent = message;
        setTimeout(() => {
          banner.hidden = true;
        }, 2800);
        return;
      }
    }
  }

  function handleError(err, fallback) {
    const message =
      err?.message || err?.error_description || fallback || "Something went wrong";
    console.error(err);
    showError(message);
    return message;
  }

  async function withLoading(label, fn, viewEl) {
    setViewLoading(viewEl, true, label);
    if (window.LifeAdminDeploy?.showLoader) window.LifeAdminDeploy.showLoader(label);
    try {
      return await fn();
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setViewLoading(viewEl, false);
      if (window.LifeAdminDeploy?.hideLoader) window.LifeAdminDeploy.hideLoader();
    }
  }

  function init() {
    applyEmptyStateMessages();
    const ver = document.getElementById("appVersion");
    if (ver) ver.textContent = APP_VERSION;
  }

  window.LifeAdminProduction = {
    APP_VERSION,
    EMPTY_MESSAGES,
    init,
    applyEmptyStateMessages,
    setViewLoading,
    showError,
    showSuccess,
    handleError,
    withLoading,
  };
})();
