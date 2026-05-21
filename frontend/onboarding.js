/**
 * Life Admin — onboarding (landing → auth → add task/reminder → done)
 */
(function () {
  const LS_COMPLETE = "life_admin_onboarding_v1";
  const LS_EMAIL = "life_admin_onboarding_email";
  const MIN_INPUT_CHARS = 2;

  let els = {};
  let handlers = {};
  let categorizeTimer = null;
  let pendingEntry = null;

  function isComplete() {
    return localStorage.getItem(LS_COMPLETE) === "true";
  }

  function markComplete() {
    localStorage.setItem(LS_COMPLETE, "true");
    document.body.classList.add("onboarding-done");
    if (els.shell) els.shell.hidden = true;
    const app = document.querySelector(".app");
    if (app) {
      app.classList.remove("app--gated");
      app.classList.add("app--surface-only");
    }
  }

  function showStep(name) {
    els.screens?.forEach((s) => {
      const active = s.dataset.onboardingStep === name;
      s.classList.toggle("onboarding__screen--active", active);
      s.hidden = !active;
    });
    if (name === "reminder") {
      refreshUserDisplayName();
      resetReminderStep();
    }
  }

  function setStatus(text) {
    if (els.reminderStatus) els.reminderStatus.textContent = text || "";
  }

  function formatDueDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function getDisplayName() {
    const ctx = window.LifeAdminAccess?.getUserContext?.();
    const full = ctx?.fullName?.trim();
    if (full) return full.split(/\s+/)[0];
    const email = localStorage.getItem(LS_EMAIL) || ctx?.email;
    if (email && email.includes("@")) {
      const local = email.split("@")[0];
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return "there";
  }

  async function refreshUserDisplayName() {
    try {
      await window.LifeAdminProfile?.initUserContext?.();
    } catch (e) {
      console.warn("Profile preload:", e.message);
    }
    if (els.userName) {
      els.userName.textContent = getDisplayName();
    }
  }

  function classifyInput(text) {
    if (window.LifeAdminIntentEngine?.classifyOnboardingInput) {
      return window.LifeAdminIntentEngine.classifyOnboardingInput(text);
    }
    const t = String(text || "").trim();
    if (!t) return null;
    const lower = t.toLowerCase();
    if (/\b(task|todo|remember to|need to)\b/i.test(lower) && !/\b(mot|passport|bill|remind)\b/i.test(lower)) {
      return {
        kind: "task",
        title: t,
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        icon: "✓",
        label: "Task",
        summary: "We'll add this as a task",
        category: "general",
      };
    }
    let category = "bills";
    let label = "Bill";
    let icon = "£";
    if (/passport|visa/.test(lower)) {
      category = "passport";
      label = "Passport";
      icon = "🛂";
    } else if (/mot|garage|car/.test(lower)) {
      category = "mot";
      label = "MOT";
      icon = "🚗";
    } else if (/subscription|netflix|spotify/.test(lower)) {
      category = "subscriptions";
      label = "Subscription";
      icon = "💳";
    }
    return {
      kind: "reminder",
      category,
      title: t,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      icon,
      label,
      summary: `Sorted as ${icon} ${label}`,
    };
  }

  function ensureReminderEls() {
    if (els.reminderInput) return;
    els.reminderInput = document.getElementById("onboardingReminderInput");
    els.livePrompt = document.getElementById("onboardingLivePrompt");
    els.promptText = document.getElementById("onboardingPromptText");
    els.promptSub = document.getElementById("onboardingPromptSub");
    els.detailsPhase = document.getElementById("onboardingDetailsPhase");
    els.detailsLead = document.getElementById("onboardingDetailsLead");
    els.detailTitleLabel = document.getElementById("onboardingDetailTitleLabel");
    els.detailTitle = document.getElementById("onboardingDetailTitle");
    els.detailDueDate = document.getElementById("onboardingDetailDueDate");
    els.detailPriorityWrap = document.getElementById("onboardingDetailPriorityWrap");
    els.detailPriority = document.getElementById("onboardingDetailPriority");
    els.detailNotesWrap = document.getElementById("onboardingDetailNotesWrap");
    els.detailNotes = document.getElementById("onboardingDetailNotes");
    els.detailsSave = document.getElementById("onboardingDetailsSave");
    els.reminderStatus = document.getElementById("onboardingReminderStatus");
  }

  function setPanelOpen(el, open) {
    if (!el) return;
    el.classList.toggle("onboarding__panel--open", open);
    if (open) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }

  function resetReminderStep() {
    pendingEntry = null;
    if (els.reminderInput) els.reminderInput.value = "";
    hideInlinePrompt();
    setStatus("");
  }

  function hideInlinePrompt() {
    setPanelOpen(els.livePrompt, false);
    setPanelOpen(els.detailsPhase, false);
    if (els.detailsSave) els.detailsSave.disabled = false;
  }

  function showInlinePrompt(result) {
    pendingEntry = result;
    const isReminder = result.kind === "reminder";

    setPanelOpen(els.livePrompt, true);
    if (els.promptText) {
      els.promptText.textContent = isReminder
        ? `This looks like a ${result.label} reminder`
        : "This looks like a task";
    }
    if (els.promptSub) {
      els.promptSub.textContent = isReminder
        ? "Add a due date and any extra details below."
        : "Add a due date and priority below.";
    }

    setPanelOpen(els.detailsPhase, true);
    if (els.detailsPhase) {
      if (els.detailsLead) {
        els.detailsLead.textContent = isReminder
          ? `${result.icon} ${result.label} reminder`
          : `${result.icon} Task`;
      }
      if (els.detailTitleLabel) {
        els.detailTitleLabel.textContent = isReminder ? "Reminder" : "Task";
      }
      if (els.detailTitle) els.detailTitle.value = result.title || "";
      if (els.detailDueDate) {
        els.detailDueDate.value = result.dueDate || "";
        els.detailDueDate.min = new Date().toISOString().slice(0, 10);
      }
      if (els.detailPriorityWrap) els.detailPriorityWrap.hidden = isReminder;
      if (els.detailNotesWrap) els.detailNotesWrap.hidden = !isReminder;
      if (els.detailsSave) {
        els.detailsSave.textContent = isReminder ? "Save reminder" : "Save task";
        els.detailsSave.disabled = false;
      }
    }

    requestAnimationFrame(() => {
      els.livePrompt?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function onInput() {
    ensureReminderEls();
    scheduleCategoryPreview();
  }

  function updateCategoryPreview() {
    ensureReminderEls();
    const text = els.reminderInput?.value?.trim();
    if (!text || text.length < MIN_INPUT_CHARS) {
      pendingEntry = null;
      hideInlinePrompt();
      return;
    }

    const result = classifyInput(text);
    if (!result) {
      hideInlinePrompt();
      return;
    }

    localStorage.setItem("life_admin_first_intent", text);
    showInlinePrompt(result);
  }

  function scheduleCategoryPreview() {
    clearTimeout(categorizeTimer);
    categorizeTimer = setTimeout(updateCategoryPreview, 150);
  }

  async function tryOAuth(provider) {
    const client = window.supabaseClient;
    if (!client?.auth?.signInWithOAuth) return false;
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn(`${provider} sign-in:`, err.message);
      return false;
    }
  }

  async function goToReminderStep() {
    showStep("reminder");
    await refreshUserDisplayName();
    els.reminderInput?.focus();
  }

  async function continueAuth(method) {
    if (method === "google") {
      const started = await tryOAuth("google");
      if (started) return;
    }
    if (method === "apple") {
      const started = await tryOAuth("apple");
      if (started) return;
    }
    if (method === "email") {
      els.emailForm?.classList.add("onboarding__email-form--open");
      els.emailInput?.focus();
      return;
    }
    await goToReminderStep();
  }

  async function submitEmail(e) {
    e?.preventDefault();
    const email = els.emailInput?.value?.trim();
    if (!email) return;
    localStorage.setItem(LS_EMAIL, email);
    const client = window.supabaseClient;
    if (client?.auth?.signInWithOtp) {
      try {
        await client.auth.signInWithOtp({ email });
        setStatus("Check your email — continuing setup…");
      } catch (err) {
        console.warn("Email OTP:", err.message);
      }
    }
    await goToReminderStep();
  }

  function showCompletion(saved) {
    showStep("complete");
    const isReminder = saved.kind === "reminder";
    if (els.completeTitle) {
      els.completeTitle.textContent = isReminder ? "Reminder added" : "Task added";
    }
    if (els.completeSub) {
      els.completeSub.textContent = "You're ready for Today.";
    }
    const rows = [
      { label: isReminder ? saved.summary : "Saved as a task", show: true },
      { label: `Due ${formatDueDate(saved.dueDate)}`, show: !!saved.dueDate },
      {
        label: isReminder ? "Saved to your reminders" : "Saved to your tasks",
        show: true,
      },
    ].filter((r) => r.show);

    if (els.completeList) {
      els.completeList.replaceChildren();
      rows.forEach((r) => {
        const li = document.createElement("li");
        li.className = "onboarding__complete-item";
        li.innerHTML = `<span class="onboarding__check" aria-hidden="true">✓</span>${r.label}`;
        els.completeList.appendChild(li);
      });
    }
  }

  async function saveDetails(e) {
    e?.preventDefault();
    if (!pendingEntry) {
      updateCategoryPreview();
      if (!pendingEntry) return;
    }

    const title = els.detailTitle?.value?.trim();
    const dueDate = els.detailDueDate?.value;
    if (!title || !dueDate) {
      setStatus("Please add a title and due date.");
      return;
    }

    els.detailsSave.disabled = true;
    setStatus("Saving…");

    const payload = {
      title,
      dueDate,
      notes: els.detailNotes?.value?.trim() || "",
      subtitle: "",
    };

    try {
      if (pendingEntry.kind === "reminder") {
        if (handlers.onCreateReminder) {
          await handlers.onCreateReminder(pendingEntry.category, payload);
        }
      } else if (handlers.onCreateTask) {
        await handlers.onCreateTask({
          title,
          dueDate,
          priority: els.detailPriority?.value || "medium",
          category: pendingEntry.category || "general",
        });
      }

      setStatus("");
      showCompletion({
        kind: pendingEntry.kind,
        summary: pendingEntry.summary,
        dueDate,
      });
    } catch (err) {
      setStatus("");
      alert(err.message || "Could not save — try again");
      els.detailsSave.disabled = false;
    }
  }

  async function finishAndEnterApp() {
    markComplete();
    if (handlers.onEnterApp) await handlers.onEnterApp();
  }

  function bind() {
    els.getStarted?.addEventListener("click", () => showStep("auth"));
    els.skipAuth?.addEventListener("click", () => goToReminderStep());

    els.authGoogle?.addEventListener("click", () => continueAuth("google"));
    els.authApple?.addEventListener("click", () => continueAuth("apple"));
    els.authEmail?.addEventListener("click", () => continueAuth("email"));
    els.emailForm?.addEventListener("submit", submitEmail);

    els.reminderInput?.addEventListener("input", scheduleCategoryPreview);
    els.reminderInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && pendingEntry) {
        e.preventDefault();
        els.detailDueDate?.focus();
      }
    });
    els.detailsForm?.addEventListener("submit", saveDetails);
    els.detailsBack?.addEventListener("click", () => {
      hideInlinePrompt();
      els.reminderInput?.focus();
    });

    els.enterApp?.addEventListener("click", finishAndEnterApp);
  }

  function init(dom, h = {}) {
    els = dom;
    handlers = h;
    bind();

    if (isComplete()) {
      document.body.classList.add("onboarding-done");
      if (els.shell) els.shell.hidden = true;
      return false;
    }

    document.body.classList.remove("onboarding-done");
    if (els.shell) els.shell.hidden = false;
    showStep("landing");
    return true;
  }

  function shouldGateApp() {
    return !isComplete();
  }

  window.LifeAdminOnboarding = {
    init,
    onInput,
    isComplete,
    markComplete,
    shouldGateApp,
    resetForDev: () => {
      localStorage.removeItem(LS_COMPLETE);
      localStorage.removeItem("life_admin_stress_focus");
    },
  };
})();
