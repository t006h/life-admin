/**
 * Life Admin — Action cards UI (Today tab)
 */
(function () {
  let els = {};
  let handlers = {};
  let runningId = null;

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function difficultyLabel(key) {
    return window.LifeAdminActionEngine?.DIFFICULTY?.[key]?.label || key;
  }

  function render(ctx) {
    if (!els.actionList) return;

    const actions = window.LifeAdminActionEngine?.generateActions?.(ctx) || [];
    if (els.actionSection) els.actionSection.hidden = actions.length === 0;
    if (els.actionCount) {
      els.actionCount.textContent = actions.length
        ? `${actions.length} thing${actions.length === 1 ? "" : "s"} to move forward`
        : "";
    }

    els.actionList.replaceChildren();

    if (!actions.length) {
      els.actionList.innerHTML = `<p class="act-empty">No actions right now — you're caught up.</p>`;
      return;
    }

    actions.forEach((action) => {
      const card = document.createElement("article");
      card.className = "act-card";
      card.dataset.actionId = action.id;

      const due = action.dueLabel ? ` <span class="act-card__due">${escape(action.dueLabel)}</span>` : "";

      card.innerHTML = `
        <header class="act-card__head">
          <span class="act-card__icon" aria-hidden="true">${escape(action.icon)}</span>
          <h3 class="act-card__title">${escape(action.title)}${due}</h3>
        </header>
        <dl class="act-card__meta">
          <div class="act-card__meta-row">
            <dt>Estimated time</dt>
            <dd>${escape(action.estimatedLabel)}</dd>
          </div>
          <div class="act-card__meta-row">
            <dt>Difficulty</dt>
            <dd>${escape(difficultyLabel(action.difficulty))}</dd>
          </div>
        </dl>
        <p class="act-card__step"><span class="act-card__step-label">Suggested next step:</span> ${escape(action.nextStep)}</p>
        <p class="act-card__status" hidden aria-live="polite"></p>
        <div class="act-card__actions">
          <button type="button" class="btn btn--primary btn--compact act-card__cta">${escape(action.ctaLabel)}</button>
          <button type="button" class="btn btn--ghost btn--compact act-card__doit">Do it for me</button>
        </div>`;

      const statusEl = card.querySelector(".act-card__status");
      const ctaBtn = card.querySelector(".act-card__cta");
      const doitBtn = card.querySelector(".act-card__doit");

      ctaBtn.addEventListener("click", () => runAction(action, card, statusEl, false));
      doitBtn.addEventListener("click", () => runAction(action, card, statusEl, true));

      els.actionList.appendChild(card);
    });
  }

  async function runAction(action, card, statusEl, assisted) {
    if (runningId) return;
    runningId = action.id;
    card.classList.add("act-card--busy");
    ctaDisable(card, true);

    try {
      if (assisted) {
        statusEl.hidden = false;
        statusEl.textContent = action.doItMessage || "Working on it…";
        await window.LifeAdminActionEngine.executeDoItForMe(action, handlers, (msg) => {
          if (msg) statusEl.textContent = msg;
          else statusEl.hidden = true;
        });
        handlers.onActionComplete?.(action, { assisted: true });
      } else {
        await window.LifeAdminActionEngine.executeAction(action, handlers);
        handlers.onActionComplete?.(action, { assisted: false });
      }
    } catch (err) {
      statusEl.hidden = false;
      statusEl.textContent = err.message || "Something went wrong";
      handlers.onActionError?.(err);
    } finally {
      runningId = null;
      card.classList.remove("act-card--busy");
      ctaDisable(card, false);
    }
  }

  function ctaDisable(card, disabled) {
    card.querySelectorAll("button").forEach((b) => {
      b.disabled = disabled;
    });
  }

  function init(dom, h = {}) {
    els = { ...dom };
    handlers = h;
  }

  window.LifeAdminActionUI = {
    init,
    render,
  };
})();
