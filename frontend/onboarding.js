/**
 * Life Admin — onboarding (landing → sign in → intent → details → done)
 */
(function () {
  const LS_COMPLETE = "life_admin_onboarding_v1";
  const LS_EMAIL = "life_admin_onboarding_email";
  const LS_FIRST_TASK = "life_admin_first_task_done";
  const EXAMPLES = [
    "MOT for my BMW",
    "Theo has a school trip",
    "Renew passport",
    "Pay insurance",
    "Plan our holiday",
  ];

  let els = {};
  let handlers = {};
  let inputTimer = null;
  let currentMatch = null;
  let lastSaved = null;

  function isComplete() {
    return localStorage.getItem(LS_COMPLETE) === "true";
  }

  function markComplete() {
    localStorage.setItem(LS_COMPLETE, "true");
    document.body.classList.add("onboarding-done");
    if (els.shell) els.shell.hidden = true;
    document.querySelector(".app")?.classList.remove("app--gated");
    document.querySelector(".app")?.classList.add("app--surface-only");
  }

  function showStep(name) {
    els.screens?.forEach((s) => {
      const on = s.dataset.onboardingStep === name;
      s.classList.toggle("onboarding__screen--active", on);
      s.hidden = !on;
    });
    if (name === "intake") refreshUserName();
    if (name === "intake") resetIntake();
  }

  function getDisplayName() {
    const ctx = window.LifeAdminAccess?.getUserContext?.() || {};
    const full = ctx.fullName?.trim();
    if (full) return full.split(/\s+/)[0];
    const email = localStorage.getItem(LS_EMAIL) || ctx.email;
    if (email?.includes("@")) {
      const local = email.split("@")[0];
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return "there";
  }

  async function refreshUserName() {
    try {
      await window.LifeAdminProfile?.initUserContext?.();
    } catch (e) {
      console.warn(e.message);
    }
    if (els.userName) els.userName.textContent = `Hi ${getDisplayName()} 👋`;
  }

  function resetIntake() {
    currentMatch = null;
    if (els.intentInput) els.intentInput.value = "";
    hideClarify();
    if (els.clarifySave) els.clarifySave.disabled = false;
  }

  function hideClarify() {
    if (els.clarifyPhase) els.clarifyPhase.hidden = true;
    if (els.clarifyFields) els.clarifyFields.replaceChildren();
  }

  function renderExamples() {
    if (!els.examples) return;
    els.examples.replaceChildren();
    EXAMPLES.forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "onboarding__chip";
      btn.textContent = text;
      btn.addEventListener("click", () => {
        if (els.intentInput) {
          els.intentInput.value = text;
          onIntentInput();
          els.intentInput.focus();
        }
      });
      els.examples.appendChild(btn);
    });
  }

  function renderClarifyFields(match) {
    const schema = window.LifeAdminOnboardingFields.getSchema(match.schemaId);
    const defaults = window.LifeAdminOnboardingFields.defaultValues(match);
    if (els.clarifyLead) els.clarifyLead.textContent = schema.lead;
    if (els.clarifyFields) {
      els.clarifyFields.replaceChildren();
      schema.fields.forEach((field) => {
        const label = document.createElement("label");
        label.className = "onboarding__field";
        const span = document.createElement("span");
        span.className = "onboarding__field-label";
        span.textContent = field.label;
        const input = document.createElement("input");
        input.className = "onboarding__field-input";
        input.id = `onboarding_field_${field.id}`;
        input.name = field.id;
        input.type = field.type || "text";
        input.required = !!field.required;
        if (defaults[field.id]) input.value = defaults[field.id];
        if (field.type === "date") {
          input.min = new Date().toISOString().slice(0, 10);
        }
        label.appendChild(span);
        label.appendChild(input);
        els.clarifyFields.appendChild(label);
      });
    }
    if (els.clarifyPhase) els.clarifyPhase.hidden = false;
    els.clarifyPhase?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function onIntentInput() {
    const text = els.intentInput?.value?.trim();
    if (!text || text.length < 2) {
      currentMatch = null;
      hideClarify();
      return;
    }
    currentMatch = window.LifeAdminOnboardingFields.detectSchema(text);
    if (!currentMatch) return;
    localStorage.setItem("life_admin_first_intent", text);
    renderClarifyFields(currentMatch);
  }

  function scheduleIntentInput() {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(onIntentInput, 180);
  }

  function readClarifyValues() {
    const schema = window.LifeAdminOnboardingFields.getSchema(currentMatch.schemaId);
    const out = {};
    schema.fields.forEach((f) => {
      const el = document.getElementById(`onboarding_field_${f.id}`);
      out[f.id] = el?.value?.trim() || "";
    });
    return out;
  }

  async function saveClarify(e) {
    e?.preventDefault();
    if (!currentMatch) return;
    const vals = readClarifyValues();
    const schema = window.LifeAdminOnboardingFields.getSchema(currentMatch.schemaId);
    for (const f of schema.fields) {
      if (f.required && !vals[f.id]) return;
    }

    if (els.clarifySave) els.clarifySave.disabled = true;
    const result = { reminders: 0, tasks: 0, notifications: 1, workflow: false };

    try {
      if (schema.kind === "task" || currentMatch.schemaId === "task") {
        if (handlers.onCreateTask) {
          await handlers.onCreateTask({
            title: vals.title || currentMatch.raw,
            dueDate: vals.dueDate,
            priority: "medium",
          });
          result.tasks = 1;
        }
      } else if (
        currentMatch.preferWorkflow &&
        schema.blueprintId &&
        window.LifeAdminSubscriptions?.canUse?.("workflows")
      ) {
        const bp = window.LifeAdminWorkflowEngine?.detectIntent?.(currentMatch.raw);
        const plan = window.LifeAdminWorkflowEngine?.parseIntent?.(currentMatch.raw)?.plan;
        if (plan && handlers.onActivateWorkflow) {
          await handlers.onActivateWorkflow(plan, { silent: true });
          result.workflow = true;
          result.tasks = plan.tasks?.length || 1;
          result.reminders = plan.reminders?.length || 1;
        }
      } else if (schema.blueprintId && handlers.onActivateWorkflow) {
        const canWf = window.LifeAdminSubscriptions?.canUse?.("workflows");
        if (canWf) {
          const parsed = window.LifeAdminWorkflowEngine?.parseIntent?.(currentMatch.raw);
          if (parsed?.plan) {
            await handlers.onActivateWorkflow(parsed.plan, { silent: true });
            result.workflow = true;
            result.tasks = parsed.plan.tasks?.length || 1;
            result.reminders = parsed.plan.reminders?.length || 1;
          }
        } else {
          window.LifeAdminSubscriptions?.showUpgrade?.("workflows");
        }
      }

      if (!result.workflow && result.tasks === 0) {
        const cat = schema.fallbackCategory || "bills";
        const title =
          vals.title ||
          vals.registration ||
          `${vals.childName ? vals.childName + " — " : ""}${currentMatch.raw}`.trim();
        const due =
          vals.motDate ||
          vals.tripDate ||
          vals.expiryDate ||
          vals.dueDate ||
          new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        if (handlers.onCreateReminder) {
          await handlers.onCreateReminder(cat, {
            title,
            dueDate: due,
            subtitle: vals.registration || vals.school || "",
            notes: vals.school || "",
          });
          result.reminders = 1;
        }
      }

      if (lastSaved) {
        lastSaved = {
          reminders: (lastSaved.reminders || 0) + result.reminders,
          tasks: (lastSaved.tasks || 0) + result.tasks,
          notifications: (lastSaved.notifications || 0) + result.notifications,
          workflow: lastSaved.workflow || result.workflow,
        };
      } else {
        lastSaved = result;
      }
      localStorage.setItem(LS_FIRST_TASK, "true");
      window.LifeAdminApp?.markFirstTaskEntryDone?.();
      if (result.tasks > 0) {
        window.LifeAdminProductAnalytics?.trackTaskCreated?.({ source: "onboarding" });
      }
      if (result.reminders > 0) {
        window.LifeAdminProductAnalytics?.trackReminderCreated?.({ source: "onboarding" });
      }
      showComplete(lastSaved);
    } catch (err) {
      window.LifeAdminProduction?.handleError?.(err, "Could not save");
    } finally {
      if (els.clarifySave) els.clarifySave.disabled = false;
    }
  }

  function showComplete(result) {
    showStep("complete");
    if (els.completeTitle) els.completeTitle.textContent = "Done ✓";
    if (els.completeSub) els.completeSub.textContent = "Created:";
    const rows = window.LifeAdminOnboardingFields.buildCompletionRows(result);
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
      console.warn(err.message);
      return false;
    }
  }

  async function continueAuth(method) {
    if (method === "google" && (await tryOAuth("google"))) return;
    if (method === "apple" && (await tryOAuth("apple"))) return;
    if (method === "email") {
      els.emailForm?.classList.add("onboarding__email-form--open");
      els.emailInput?.focus();
      return;
    }
    showStep("intake");
    els.intentInput?.focus();
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
      } catch (err) {
        console.warn(err.message);
      }
    }
    showStep("intake");
    els.intentInput?.focus();
  }

  function addAnother() {
    resetIntake();
    showStep("intake");
    els.intentInput?.focus();
  }

  function tryExample(text = EXAMPLES[0]) {
    showStep("intake");
    refreshUserName();
    if (els.intentInput) {
      els.intentInput.value = text;
      onIntentInput();
      els.intentInput.focus();
    }
  }

  function forceShowFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") !== "1") return false;
    localStorage.removeItem(LS_COMPLETE);
    return true;
  }

  async function finishAndEnterApp() {
    markComplete();
    if (handlers.onEnterApp) await handlers.onEnterApp();
  }

  function bind() {
    els.getStarted?.addEventListener("click", () => showStep("auth"));
    els.tryExample?.addEventListener("click", () => tryExample());
    els.skipAuth?.addEventListener("click", () => {
      showStep("intake");
      els.intentInput?.focus();
    });
    els.authGoogle?.addEventListener("click", () => continueAuth("google"));
    els.authApple?.addEventListener("click", () => continueAuth("apple"));
    els.authEmail?.addEventListener("click", () => continueAuth("email"));
    els.emailForm?.addEventListener("submit", submitEmail);
    els.intentInput?.addEventListener("input", scheduleIntentInput);
    els.clarifyForm?.addEventListener("submit", saveClarify);
    els.addAnother?.addEventListener("click", addAnother);
    els.enterApp?.addEventListener("click", finishAndEnterApp);
    els.micBtn?.addEventListener("click", () => {
      alert("Voice input coming soon — type for now.");
    });
  }

  function init(dom, h = {}) {
    els = dom;
    handlers = h;
    bind();
    renderExamples();

    forceShowFromQuery();

    if (isComplete()) {
      document.body.classList.add("onboarding-done");
      if (els.shell) els.shell.hidden = true;
      return false;
    }

    document.body.classList.remove("onboarding-done");
    if (els.shell) els.shell.hidden = false;
    window.LifeAdminDeploy?.hideLoader?.();
    window.LifeAdminDeploy?.hideFatalError?.();
    showStep("landing");
    return true;
  }

  window.LifeAdminOnboarding = {
    init,
    onInput: scheduleIntentInput,
    isComplete,
    markComplete,
    tryExample,
    resetForDev: () => {
      localStorage.removeItem(LS_COMPLETE);
      localStorage.removeItem(LS_FIRST_TASK);
    },
  };
})();
