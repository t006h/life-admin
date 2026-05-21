/**
 * Life Admin — onboarding (landing → auth → add reminder → done)
 */
(function () {
  const LS_COMPLETE = "life_admin_onboarding_v1";
  const LS_EMAIL = "life_admin_onboarding_email";

  const REMINDER_EXAMPLES = [
    "MOT due in June",
    "Passport expires March 2027",
    "Netflix subscription £15.99",
    "Council tax payment",
  ];

  let els = {};
  let handlers = {};
  let categorizeTimer = null;
  let lastCategorized = null;

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

  function updateCategoryPreview() {
    const text = els.reminderInput?.value?.trim();
    if (!text) {
      lastCategorized = null;
      if (els.reminderCategory) els.reminderCategory.hidden = true;
      if (els.reminderSubmit) els.reminderSubmit.disabled = true;
      return;
    }

    const result = window.LifeAdminIntentEngine?.categorizeReminder?.(text);
    lastCategorized = result;
    if (!result || !els.reminderCategory) return;

    els.reminderCategory.hidden = false;
    if (els.reminderCategoryLabel) {
      els.reminderCategoryLabel.textContent = `${result.icon} ${result.label}`;
    }
    if (els.reminderCategoryDetail) {
      els.reminderCategoryDetail.textContent = result.summary;
    }
    if (els.reminderSubmit) els.reminderSubmit.disabled = false;
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
    showStep("reminder");
    els.reminderInput?.focus();
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
    showStep("reminder");
    els.reminderInput?.focus();
  }

  function showCompletion(result) {
    showStep("complete");
    if (els.completeTitle) {
      els.completeTitle.textContent = "Reminder added";
    }
    if (els.completeSub) {
      els.completeSub.textContent = "We've sorted it — you're ready for Today.";
    }
    const rows = [
      { label: result.summary, show: true },
      { label: `Due ${formatDueDate(result.dueDate)}`, show: !!result.dueDate },
      { label: "Saved to your reminders", show: true },
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

  async function submitReminder() {
    const text = els.reminderInput?.value?.trim();
    if (!text) return;

    const result = window.LifeAdminIntentEngine?.categorizeReminder?.(text);
    if (!result) return;

    els.reminderSubmit.disabled = true;
    setStatus("Adding your reminder…");

    try {
      if (handlers.onCreateReminder) {
        await handlers.onCreateReminder(result.category, {
          title: result.title,
          dueDate: result.dueDate,
          subtitle: "",
          notes: "",
        });
      }
      localStorage.setItem("life_admin_first_intent", text);
      setStatus("");
      showCompletion(result);
    } catch (err) {
      setStatus("");
      alert(err.message || "Could not save — try again");
      els.reminderSubmit.disabled = false;
    }
  }

  async function finishAndEnterApp() {
    markComplete();
    if (handlers.onEnterApp) await handlers.onEnterApp();
  }

  function bind() {
    els.getStarted?.addEventListener("click", () => showStep("auth"));
    els.skipAuth?.addEventListener("click", () => {
      showStep("reminder");
      els.reminderInput?.focus();
    });

    els.authGoogle?.addEventListener("click", () => continueAuth("google"));
    els.authApple?.addEventListener("click", () => continueAuth("apple"));
    els.authEmail?.addEventListener("click", () => continueAuth("email"));
    els.emailForm?.addEventListener("submit", submitEmail);

    els.reminderInput?.addEventListener("input", scheduleCategoryPreview);
    els.reminderForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitReminder();
    });

    els.exampleChips?.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (els.reminderInput) {
          els.reminderInput.value = chip.textContent;
          updateCategoryPreview();
          els.reminderInput.focus();
        }
      });
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
    if (els.reminderSubmit) els.reminderSubmit.disabled = true;
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
