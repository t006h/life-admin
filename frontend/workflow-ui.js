/**
 * Life Admin — Workflow Engine UI (intent result + Today workflow cards)
 */
(function () {
  let intentEls = {};
  let cardEls = {};
  let handlers = {};
  let lastPlan = null;

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderExamples() {
    if (!intentEls.intentExamples) return;
    intentEls.intentExamples.replaceChildren();
    const chips =
      window.LifeAdminWorkflowEngine?.EXAMPLE_CHIPS ||
      window.LifeAdminIntentEngine?.EXAMPLE_CHIPS ||
      [];
    chips.forEach((phrase) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "intent-chip";
      btn.textContent = phrase;
      btn.addEventListener("click", () => {
        if (intentEls.intentInput) {
          intentEls.intentInput.value = phrase;
          intentEls.intentInput.focus();
          handleSubmit();
        }
      });
      intentEls.intentExamples.appendChild(btn);
    });
  }

  function renderContextNotes(plan) {
    if (!intentEls.intentContextSection || !intentEls.intentContextList) return;
    if (!plan?.contextNotes?.length) {
      intentEls.intentContextSection.hidden = true;
      return;
    }
    intentEls.intentContextSection.hidden = false;
    intentEls.intentContextList.replaceChildren();
    plan.contextNotes.forEach((n) => {
      const li = document.createElement("li");
      li.className = "wf-context-note";
      li.innerHTML = `<span class="wf-context-note__icon" aria-hidden="true">${escape(n.icon || "💡")}</span>
        <span class="wf-context-note__text">${escape(n.text)}</span>`;
      intentEls.intentContextList.appendChild(li);
    });
  }

  function renderPlanPreview(plan) {
    renderContextNotes(plan);
    if (!intentEls.intentForgetting || !plan) return;

    const list = intentEls.intentForgetting;
    list.replaceChildren();

    if (!plan.forgetting?.length && !plan.aiSuggestions?.length) {
      intentEls.intentForgetSection.hidden = true;
      return;
    }

    intentEls.intentForgetSection.hidden = false;
    const hints = plan.forgetting?.length ? plan.forgetting : plan.aiSuggestions;
    hints.slice(0, 5).forEach((h) => {
      const li = document.createElement("li");
      li.className = "wf-forget-item";
      li.innerHTML = `<span class="wf-forget-item__text">${escape(h.text)}</span>
        <span class="wf-forget-item__sub">${escape(h.sub || "")}</span>`;
      list.appendChild(li);
    });
  }

  function renderPlanMeta(plan) {
    if (!intentEls.intentPlanMeta || !plan) {
      if (intentEls.intentPlanMeta) intentEls.intentPlanMeta.hidden = true;
      return;
    }
    intentEls.intentPlanMeta.hidden = false;
    const checks = plan.items?.filter((i) => i.kind === "checklist").length || 0;
    const tasks = plan.tasks?.length || 0;
    const rems = plan.reminders?.length || 0;
    const blocks = plan.calendarBlocks?.length || 0;
    intentEls.intentPlanMeta.textContent = `${checks} checklist steps · ${tasks} tasks · ${rems} reminders · ${blocks} calendar blocks · ${plan.timelineLabel || ""}`;
  }

  function renderResult(result) {
    if (!intentEls.intentResult) return;

    if (!result) {
      intentEls.intentResult.hidden = true;
      lastPlan = null;
      if (intentEls.intentContextSection) intentEls.intentContextSection.hidden = true;
      return;
    }

    lastPlan = result.plan || null;
    intentEls.intentResult.hidden = false;
    if (intentEls.intentResultIcon) intentEls.intentResultIcon.textContent = result.icon || "✨";
    if (intentEls.intentResultSummary) intentEls.intentResultSummary.textContent = result.summary;

    renderPlanMeta(lastPlan);
    renderPlanPreview(lastPlan);

    if (intentEls.intentActions) {
      intentEls.intentActions.replaceChildren();
      (result.actions || []).forEach((action, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `intent-action${i === 0 ? " intent-action--primary" : ""}`;
        btn.textContent = action.label;
        btn.addEventListener("click", () => executeAction(action));
        intentEls.intentActions.appendChild(btn);
      });
    }
  }

  async function executeAction(action) {
    if (!action || !handlers) return;

    try {
      switch (action.type) {
        case "activate_workflow":
          await handlers.onActivateWorkflow?.(action.plan);
          break;
        case "preview_workflow":
          if (action.plan?.blueprintId && action.plan.blueprintId !== "generic") {
            handlers.onNavigate?.("life-events");
          }
          return;
        case "workflow":
          await handlers.onStartWorkflow?.(action.workflowType);
          break;
        case "reminder":
          await handlers.onAddReminder?.(action.category, {
            title: action.title,
            dueDate: action.dueDate,
            subtitle: "",
          });
          break;
        case "task":
          await handlers.onAddTask?.({
            title: action.title,
            dueDate: action.dueDate,
            priority: action.priority || "medium",
            category: action.category || "general",
          });
          break;
        case "family_reminder":
          await handlers.onAddFamilyReminder?.({
            title: action.title,
            dueDate: action.dueDate,
          });
          break;
        case "calendar":
          handlers.onNavigate?.("planning");
          break;
        case "plan_week":
          handlers.onNavigate?.("planning");
          setTimeout(() => document.getElementById("btnPlanWeek")?.click(), 300);
          break;
        case "calendar_block":
          await handlers.onAddCalendarBlock?.(action);
          break;
        case "vault":
          handlers.onNavigate?.("vault");
          break;
        case "vault_upload":
          handlers.onNavigate?.("vault");
          setTimeout(() => document.querySelector('[data-vault-action="upload"]')?.click(), 400);
          break;
        case "navigate":
          handlers.onNavigate?.(action.view);
          break;
        case "ai_suggestion":
          handlers.onNavigate?.("ai");
          break;
        case "brain_dump":
          handlers.onBrainDump?.();
          break;
        default:
          break;
      }
      if (action.type !== "preview_workflow") {
        if (intentEls.intentResult) intentEls.intentResult.hidden = true;
        if (intentEls.intentInput) intentEls.intentInput.value = "";
        handlers.onIntentComplete?.();
      }
    } catch (err) {
      alert(`Could not complete: ${err.message || "Something went wrong"}`);
    }
  }

  let submitting = false;

  async function handleSubmit() {
    const text = intentEls.intentInput?.value?.trim();
    if (!text || submitting) return;
    submitting = true;

    const parse = window.LifeAdminWorkflowEngine?.parseIntent || window.LifeAdminIntentEngine?.parseIntent;
    const result = parse?.(text);

    if (!result) {
      renderResult({
        summary: "Try describing what you need — e.g. renew passport, moving house, buy a car",
        icon: "💡",
        actions: [{ type: "brain_dump", label: "Brain dump ideas", id: "bd" }],
      });
      submitting = false;
      return;
    }

    renderResult(result);
    intentEls.intentResult?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });

    if (
      result.plan &&
      result.detection?.confidence === "high" &&
      result.plan.blueprintId !== "generic" &&
      handlers.autoActivate !== false
    ) {
      try {
        await handlers.onActivateWorkflow?.(result.plan, { silent: true });
        if (intentEls.intentResultSummary && result.plan) {
          intentEls.intentResultSummary.textContent = `Created ${result.plan.title} — check your workflow card below`;
        }
        if (intentEls.intentInput) intentEls.intentInput.value = "";
        handlers.onIntentComplete?.();
        renderWorkflowCards();
      } catch (e) {
        console.warn("Auto workflow:", e.message);
      }
    }
    submitting = false;
  }

  function renderWorkflowCards() {
    const root = cardEls.workflowCardsList;
    const section = cardEls.workflowCardsSection;
    if (!root) return;

    const events = window.LifeAdminLifeEvents?.getEvents?.() || [];
    const active = events.filter((e) => e.status === "active");
    if (section) section.hidden = active.length === 0;

    root.replaceChildren();
    if (!active.length) {
      root.innerHTML = `<p class="wf-cards-empty">Workflows you start will appear here with progress and next steps.</p>`;
      return;
    }

    active.forEach((ev) => {
      const card = window.LifeAdminWorkflowEngine.buildCard(ev);
      const el = document.createElement("article");
      el.className = "wf-card";
      el.innerHTML = `
        <header class="wf-card__head">
          <span class="wf-card__icon" aria-hidden="true">${escape(card.icon)}</span>
          <div class="wf-card__titles">
            <h3 class="wf-card__name">${escape(card.title)}</h3>
            <p class="wf-card__effort">${escape(card.effort)}</p>
          </div>
          <span class="wf-card__pct">${card.percent}%</span>
        </header>
        <div class="wf-card__bar" role="progressbar" aria-valuenow="${card.percent}" aria-valuemin="0" aria-valuemax="100">
          <span class="wf-card__bar-fill" style="width:${card.percent}%"></span>
        </div>
        <p class="wf-card__timeline">${escape(card.timeline)}</p>
        <p class="wf-card__next"><span class="wf-card__next-label">Next action:</span> ${escape(card.nextAction)}</p>
        <button type="button" class="wf-card__open">Open workflow</button>`;
      el.querySelector(".wf-card__open").addEventListener("click", () => {
        handlers.onOpenWorkflow?.(ev.id);
      });
      root.appendChild(el);
    });
  }

  function initIntent(dom, h = {}) {
    intentEls = { ...dom };
    handlers = h;
    renderExamples();

    intentEls.intentForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmit();
    });

  }

  function initCards(dom, h = {}) {
    cardEls = { ...dom };
    if (h.onOpenWorkflow) handlers.onOpenWorkflow = h.onOpenWorkflow;
    renderWorkflowCards();
  }

  window.LifeAdminWorkflowUI = {
    initIntent,
    initCards,
    handleSubmit,
    renderResult,
    renderWorkflowCards,
    executeAction,
  };

  window.LifeAdminIntent = {
    init: initIntent,
    handleSubmit,
    renderResult,
    executeAction,
  };
})();
