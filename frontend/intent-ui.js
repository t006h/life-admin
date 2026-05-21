/**
 * Life Admin — intent-first UI (Today hero + result execution)
 */
(function () {
  let els = {};
  let handlers = {};
  let lastResult = null;

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderExamples() {
    if (!els.intentExamples) return;
    els.intentExamples.replaceChildren();
    const chips = window.LifeAdminIntentEngine?.EXAMPLE_CHIPS || [];
    chips.forEach((phrase) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "intent-chip";
      btn.textContent = phrase;
      btn.addEventListener("click", () => {
        if (els.intentInput) {
          els.intentInput.value = phrase;
          els.intentInput.focus();
          handleSubmit();
        }
      });
      els.intentExamples.appendChild(btn);
    });
  }

  function renderResult(result) {
    lastResult = result;
    if (!els.intentResult) return;

    if (!result) {
      els.intentResult.hidden = true;
      return;
    }

    els.intentResult.hidden = false;
    if (els.intentResultIcon) els.intentResultIcon.textContent = result.icon || "✨";
    if (els.intentResultSummary) els.intentResultSummary.textContent = result.summary;

    if (els.intentActions) {
      els.intentActions.replaceChildren();
      result.actions.forEach((action, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `intent-action${i === 0 ? " intent-action--primary" : ""}`;
        btn.textContent = action.label;
        btn.addEventListener("click", () => executeAction(action));
        els.intentActions.appendChild(btn);
      });
    }
  }

  async function executeAction(action) {
    if (!action || !handlers) return;

    try {
      switch (action.type) {
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
      if (els.intentResult) els.intentResult.hidden = true;
      if (els.intentInput) els.intentInput.value = "";
      handlers.onIntentComplete?.();
    } catch (err) {
      alert(`Could not complete: ${err.message || "Something went wrong"}`);
    }
  }

  function handleSubmit() {
    const text = els.intentInput?.value?.trim();
    if (!text) return;
    const result = window.LifeAdminIntentEngine.parseIntent(text);
    if (!result) {
      renderResult({
        summary: "Try describing what you need — e.g. renew passport, moving house, book dentist",
        icon: "💡",
        actions: [{ type: "brain_dump", label: "Brain dump ideas", id: "bd" }],
      });
      return;
    }
    renderResult(result);
    els.intentResult?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }

  function init(dom, h = {}) {
    els = { ...dom };
    handlers = h;

    renderExamples();

    els.intentForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmit();
    });

    els.intentToggleDay?.addEventListener("click", () => {
      const fold = document.getElementById("todayBelowFold");
      if (!fold) return;
      const open = fold.classList.toggle("today-below-fold--open");
      els.intentToggleDay.setAttribute("aria-expanded", open ? "true" : "false");
      els.intentToggleDay.textContent = open ? "Hide your day" : "See your full day";
    });
  }

  window.LifeAdminIntent = {
    init,
    handleSubmit,
    renderResult,
    executeAction,
  };
})();
