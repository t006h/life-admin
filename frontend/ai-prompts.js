/**
 * Life Admin — AI Chief of Staff prompt cards
 */
(function () {
  const PROMPTS = [
    {
      id: "today",
      icon: "✓",
      label: "What should I do today?",
      run: (h) => {
        h.onNavigate?.("dashboard");
        setTimeout(() => document.getElementById("actionCardsSection")?.scrollIntoView?.({ behavior: "smooth" }), 200);
      },
    },
    {
      id: "forgetting",
      icon: "💡",
      label: "What am I forgetting?",
      run: (h) => {
        h.onNavigate?.("ai");
        setTimeout(() => document.getElementById("aiHintsList")?.scrollIntoView?.({ behavior: "smooth" }), 300);
      },
    },
    {
      id: "week",
      icon: "📅",
      label: "Plan my week",
      run: (h) => {
        h.onNavigate?.("ai");
        setTimeout(() => document.getElementById("btnPlanWeek")?.click(), 350);
      },
    },
    {
      id: "family",
      icon: "👨‍👩‍👧",
      label: "Summarize family life",
      run: (h) => {
        h.onNavigate?.("ai");
        h.onFamilySummary?.();
      },
    },
    {
      id: "risks",
      icon: "⚠",
      label: "Upcoming risks",
      run: (h) => {
        h.onNavigate?.("ai");
        h.onRisksSummary?.();
      },
    },
  ];

  let els = {};
  let handlers = {};

  function render() {
    if (!els.promptGrid) return;
    els.promptGrid.replaceChildren();
    const cap = window.LifeAdminOS?.LIST_CAP || 5;
    PROMPTS.slice(0, cap).forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-prompt-card";
      btn.innerHTML = `<span class="ai-prompt-card__icon" aria-hidden="true">${p.icon}</span>
        <span class="ai-prompt-card__label">${p.label}</span>`;
      btn.addEventListener("click", () => p.run(handlers));
      els.promptGrid.appendChild(btn);
    });
  }

  function init(dom, h = {}) {
    els = { ...dom };
    handlers = h;
    render();
  }

  window.LifeAdminAiPrompts = {
    init,
    render,
    PROMPTS,
  };
})();
