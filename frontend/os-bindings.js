/**
 * Life Admin — OS UI bindings (show-more, list caps)
 */
(function () {
  function wireShowMore(btnId, wrapSelector) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const wrap = btn.previousElementSibling;
    const list =
      wrap?.querySelector?.("ul, ol, .act-cards-list, .wf-cards-list, .vault-doc-list, .ctx-list-wrap") ||
      wrap;
    if (!list) return;

    const countItems = () => {
      if (list.classList.contains("act-cards-list") || list.classList.contains("wf-cards-list")) {
        return list.querySelectorAll(".act-card, .wf-card").length;
      }
      if (list.classList.contains("vault-doc-list")) {
        return list.querySelectorAll(".vault-doc-card-wrap").length;
      }
      if (list.classList.contains("ctx-list-wrap")) {
        return list.querySelectorAll(".ctx-memory-item").length;
      }
      return list.querySelectorAll(":scope > li, :scope > article").length;
    };

    const refresh = () => {
      const n = countItems();
      const cap = window.LifeAdminOS?.LIST_CAP || 5;
      const surfaceCap =
        list.classList.contains("act-cards-list")
          ? window.LifeAdminOS?.SURFACE_ACTION_CAP || 3
          : list.classList.contains("wf-cards-list")
            ? window.LifeAdminOS?.SURFACE_WORKFLOW_CAP || 3
            : cap;
      const useCap = surfaceCap;
      btn.hidden = n <= useCap;
      if (!btn.hidden) {
        btn.textContent = btn.dataset.expanded === "true" ? "Show less" : `Show more (${n - useCap})`;
      }
    };

    btn.addEventListener("click", () => {
      const expanded = btn.dataset.expanded === "true";
      btn.dataset.expanded = expanded ? "false" : "true";
      list.classList.toggle("os-list--expanded", !expanded);
      if (list.classList.contains("act-cards-list") || list.classList.contains("wf-cards-list")) {
        list.classList.toggle("os-list--capped", expanded);
      }
      refresh();
    });

    refresh();
    return refresh;
  }

  function initAll() {
    const refreshers = [
      wireShowMore("prioritiesMore"),
      wireShowMore("upcomingMore"),
      wireShowMore("timelineMore"),
      wireShowMore("insightsMore"),
      wireShowMore("actionCardsMore"),
      wireShowMore("workflowCardsMore"),
      wireShowMore("aiActionsMore"),
      wireShowMore("aiHintsMore"),
      wireShowMore("vaultDocsMore"),
    ].filter(Boolean);

    window.LifeAdminOSRefreshLists = () => refreshers.forEach((r) => r());
  }

  window.LifeAdminOSBindings = { initAll, wireShowMore };
})();
