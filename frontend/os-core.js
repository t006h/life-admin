/**
 * Life Admin — Life OS core (family-first UX constants & list caps)
 */
(function () {
  const LIST_CAP = 5;
  const SURFACE_ACTION_CAP = 3;
  const SURFACE_WORKFLOW_CAP = 3;

  const TAGLINE = "Remembers and handles life so your family doesn't have to.";

  function capArray(items, max = LIST_CAP) {
    return (items || []).slice(0, max);
  }

  function appendShowMore(listEl, total, max = LIST_CAP, label = "Show more") {
    if (!listEl || total <= max) return null;
    const hidden = total - max;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "os-show-more";
    btn.textContent = `${label} (${hidden})`;
    btn.dataset.expanded = "false";
    btn.addEventListener("click", () => {
      const expanded = btn.dataset.expanded === "true";
      btn.dataset.expanded = expanded ? "false" : "true";
      listEl.classList.toggle("os-list--expanded", !expanded);
      btn.textContent = expanded ? `${label} (${hidden})` : "Show less";
    });
    return btn;
  }

  window.LifeAdminOS = {
    LIST_CAP,
    SURFACE_ACTION_CAP,
    SURFACE_WORKFLOW_CAP,
    TAGLINE,
    capArray,
    appendShowMore,
  };
})();
