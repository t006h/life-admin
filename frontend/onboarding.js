/**
 * Life Admin — onboarding & first-use (60-second relief path)
 */
(function () {
  const LS_COMPLETE = "life_admin_onboarding_v1";
  const LS_STRESS = "life_admin_stress_focus";
  const LS_EMAIL = "life_admin_onboarding_email";

  const STRESS_OPTIONS = [
    { id: "family", label: "Family schedules", memoryTitle: "Stress focus: family", memoryBody: "Family schedules create the most stress — prioritize shared calendar and school reminders." },
    { id: "bills", label: "Bills & finances", memoryTitle: "Stress focus: finances", memoryBody: "Bills and finances create the most stress — prioritize renewals and payment reminders." },
    { id: "documents", label: "Documents", memoryTitle: "Stress focus: documents", memoryBody: "Documents create the most stress — prioritize vault, passport, and expiry tracking." },
    { id: "household", label: "Household", memoryTitle: "Stress focus: household", memoryBody: "Household admin creates the most stress — prioritize movers, utilities, and shared tasks." },
    { id: "everything", label: "Everything", memoryTitle: "Stress focus: everything", memoryBody: "A bit of everything creates stress — Life Admin will surface only what matters today." },
  ];

  const FIRST_EXAMPLES = [
    "Renew my passport",
    "Theo has a school trip",
    "We're moving house",
  ];

  let els = {};
  let handlers = {};
  let selectedStress = null;
  let pendingPlan = null;

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
    if (els.firstUseStatus) els.firstUseStatus.textContent = text || "";
  }

  async function saveStressMemory(option) {
    localStorage.setItem(LS_STRESS, option.id);
    try {
      await window.LifeAdminContextEngine?.saveMemory?.({
        category: "preferences",
        title: option.memoryTitle,
        body: option.memoryBody,
        source: "user",
      });
    } catch (e) {
      console.warn("Stress memory save:", e.message);
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
    showStep("stress");
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
    showStep("stress");
  }

  function selectStress(option) {
    selectedStress = option;
    els.stressOptions?.forEach((btn) => {
      btn.classList.toggle(
        "onboarding__option--selected",
        btn.dataset.stressId === option.id
      );
    });
    els.stressContinue.disabled = false;
  }

  async function runFirstWorkflow(text) {
    const parse = window.LifeAdminWorkflowEngine?.parseIntent;
    if (!parse) throw new Error("Workflow engine not ready");

    const result = parse(text);
    if (!result?.plan || result.detection?.blueprintId === "generic") {
      if (handlers.onAddTask) {
        await handlers.onAddTask({
          title: text,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          priority: "medium",
        });
      }
      return {
        workflowName: "Your first task",
        tasks: 1,
        reminders: 0,
        checklist: 0,
      };
    }

    pendingPlan = result.plan;
    if (!handlers.onActivateWorkflow) {
      return {
        workflowName: plan.title,
        tasks: plan.tasks?.length || 0,
        reminders: plan.reminders?.length || 0,
        checklist: plan.items?.filter((i) => i.kind === "checklist").length || 0,
      };
    }
    const ev = await handlers.onActivateWorkflow(result.plan, { silent: true });
    const plan = result.plan;
    const checklist = plan.items?.filter((i) => i.kind === "checklist").length || 0;
    return {
      workflowName: plan.title,
      tasks: plan.tasks?.length || 0,
      reminders: plan.reminders?.length || 0,
      checklist,
      workflowId: ev?.id,
    };
  }

  function showCompletion(stats) {
    showStep("complete");
    if (els.completeTitle) {
      els.completeTitle.textContent = `${stats.workflowName} is ready`;
    }
    if (els.completeSub) {
      els.completeSub.textContent = "We've handled the setup — you can breathe now.";
    }
    const rows = [
      { label: "Workflow created", show: true },
      { label: `${stats.checklist || 0} checklist steps`, show: (stats.checklist || 0) > 0 },
      { label: `${stats.tasks} task${stats.tasks === 1 ? "" : "s"} added`, show: stats.tasks > 0 },
      { label: `${stats.reminders} reminder${stats.reminders === 1 ? "" : "s"} set`, show: stats.reminders > 0 },
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

  async function submitFirstUse() {
    const text = els.firstUseInput?.value?.trim();
    if (!text) return;

    localStorage.setItem("life_admin_first_intent", text);
    els.firstUseSubmit.disabled = true;
    setStatus("Creating your workflow…");

    try {
      if (!handlers.onActivateWorkflow) {
        await new Promise((r) => setTimeout(r, 800));
      }
      const stats = await runFirstWorkflow(text);
      setStatus("Almost done…");
      await new Promise((r) => setTimeout(r, 600));
      showCompletion(stats);
    } catch (err) {
      setStatus("");
      alert(err.message || "Could not set up — try again");
      els.firstUseSubmit.disabled = false;
    }
  }

  async function finishAndEnterApp() {
    markComplete();
    if (handlers.onEnterApp) await handlers.onEnterApp();
  }

  function bind() {
    els.getStarted?.addEventListener("click", () => showStep("auth"));
    els.skipAuth?.addEventListener("click", () => showStep("stress"));

    els.authGoogle?.addEventListener("click", () => continueAuth("google"));
    els.authApple?.addEventListener("click", () => continueAuth("apple"));
    els.authEmail?.addEventListener("click", () => continueAuth("email"));
    els.emailForm?.addEventListener("submit", submitEmail);

    els.stressOptions?.forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = STRESS_OPTIONS.find((o) => o.id === btn.dataset.stressId);
        if (opt) selectStress(opt);
      });
    });

    els.stressContinue?.addEventListener("click", async () => {
      if (!selectedStress) return;
      await saveStressMemory(selectedStress);
      showStep("first-use");
      els.firstUseInput?.focus();
    });

    els.firstUseForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitFirstUse();
    });

    els.exampleChips?.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (els.firstUseInput) {
          els.firstUseInput.value = chip.textContent;
          els.firstUseInput.focus();
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
    STRESS_OPTIONS,
    resetForDev: () => {
      localStorage.removeItem(LS_COMPLETE);
      localStorage.removeItem(LS_STRESS);
    },
  };
})();
