/**
 * Life Admin — onboarding (landing → auth → add task/reminder → done)
 */
(function () {
  const LS_COMPLETE = "life_admin_onboarding_v1";
  const LS_EMAIL = "life_admin_onboarding_email";

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
      showEntryPhase();
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

  function showEntryPhase() {
    pendingEntry = null;
    if (els.entryPhase) els.entryPhase.hidden = false;
    if (els.detailsPhase) els.detailsPhase.hidden = true;
    if (els.reminderCategory) els.reminderCategory.hidden = true;
    if (els.reminderContinue) els.reminderContinue.disabled = true;
    setStatus("");
  }

  function showDetailsPhase(classified) {
    pendingEntry = classified;
    if (els.entryPhase) els.entryPhase.hidden = true;
    if (els.detailsPhase) els.detailsPhase.hidden = false;

    const isReminder = classified.kind === "reminder";
    if (els.detailsLead) {
      els.detailsLead.textContent = isReminder
        ? `Add details for your ${classified.label} reminder`
        : "Add details for your task";
    }
    if (els.detailTitleLabel) {
      els.detailTitleLabel.textContent = isReminder ? "Reminder" : "Task";
    }
    if (els.detailTitle) els.detailTitle.value = classified.title || "";
    if (els.detailDueDate) els.detailDueDate.value = classified.dueDate || "";
    if (els.detailPriorityWrap) els.detailPriorityWrap.hidden = isReminder;
    if (els.detailNotesWrap) els.detailNotesWrap.hidden = !isReminder;
    if (els.detailNotes) els.detailNotes.value = "";
    if (els.detailsSave) {
      els.detailsSave.textContent = isReminder ? "Save reminder" : "Save task";
    }
    els.detailTitle?.focus();
  }

  function updateCategoryPreview() {
    const text = els.reminderInput?.value?.trim();
    if (!text) {
      pendingEntry = null;
      if (els.reminderCategory) els.reminderCategory.hidden = true;
      if (els.reminderContinue) els.reminderContinue.disabled = true;
      return;
    }

    const result = window.LifeAdminIntentEngine?.classifyOnboardingInput?.(text);
    pendingEntry = result;
    if (!result || !els.reminderCategory) return;

    els.reminderCategory.hidden = false;
    if (els.reminderCategoryLabel) {
      const kindLabel = result.kind === "task" ? "Task" : "Reminder";
      els.reminderCategoryLabel.textContent =
        result.kind === "reminder"
          ? `${result.icon} ${kindLabel} · ${result.label}`
          : `${result.icon} ${kindLabel}`;
    }
    if (els.reminderCategoryDetail) {
      els.reminderCategoryDetail.textContent = result.summary;
    }
    if (els.reminderContinue) els.reminderContinue.disabled = false;
  }

  function scheduleCategoryPreview() {
    clearTimeout(categorizeTimer);
    categorizeTimer = setTimeout(updateCategoryPreview, 200);
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
      {
        label: isReminder ? saved.summary : "Saved as a task",
        show: true,
      },
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

  function proceedToDetails(e) {
    e?.preventDefault();
    const text = els.reminderInput?.value?.trim();
    if (!text) return;

    const result =
      pendingEntry || window.LifeAdminIntentEngine?.classifyOnboardingInput?.(text);
    if (!result) return;

    localStorage.setItem("life_admin_first_intent", text);
    showDetailsPhase(result);
  }

  async function saveDetails(e) {
    e?.preventDefault();
    if (!pendingEntry) return;

    const title = els.detailTitle?.value?.trim();
    const dueDate = els.detailDueDate?.value;
    if (!title || !dueDate) return;

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
    els.reminderForm?.addEventListener("submit", proceedToDetails);
    els.detailsForm?.addEventListener("submit", saveDetails);
    els.detailsBack?.addEventListener("click", showEntryPhase);

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
    if (els.reminderContinue) els.reminderContinue.disabled = true;
    return true;
  }

  function shouldGateApp() {
    return !isComplete();
  }

  window.LifeAdminOnboarding = {
    init,
    isComplete,
    markComplete,
    shouldGateApp,
    resetForDev: () => {
      localStorage.removeItem(LS_COMPLETE);
      localStorage.removeItem("life_admin_stress_focus");
    },
  };
})();
