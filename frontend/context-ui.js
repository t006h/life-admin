/**
 * Life Admin — Context UI ("What I know" on AI tab)
 */
(function () {
  let els = {};
  let handlers = {};
  let editingId = null;

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function sourceLabel(source) {
    if (source === "family_sync") return "From family";
    if (source === "inferred") return "Inferred";
    return "You added";
  }

  function render() {
    if (!els.contextCard || !window.LifeAdminContextEngine?.canUseContext?.()) {
      if (els.contextCard) els.contextCard.hidden = true;
      return;
    }

    const grouped = window.LifeAdminContextEngine.getByCategory();
    const cap = window.LifeAdminOS?.LIST_CAP || 5;
    let shown = 0;
    const total = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

    if (els.contextCount) {
      const extra = total > cap ? ` · showing ${Math.min(cap, shown)}` : "";
      els.contextCount.textContent = total
        ? `${total} memories${extra}`
        : "No memories yet";
    }

    if (!els.contextList) return;
    els.contextList.replaceChildren();

    if (!total) {
      els.contextList.innerHTML = `<p class="ctx-empty">Add what Life Admin should remember — people, preferences, dates, and habits.</p>`;
      return;
    }

    Object.entries(window.LifeAdminContextEngine.CATEGORIES).forEach(([key, meta]) => {
      const items = grouped[key] || [];
      if (!items.length || shown >= cap) return;

      const section = document.createElement("div");
      section.className = "ctx-group";
      section.innerHTML = `<h3 class="ctx-group__title"><span aria-hidden="true">${meta.icon}</span> ${escape(meta.label)}</h3>`;

      const ul = document.createElement("ul");
      ul.className = "ctx-memory-list";

      items.slice(0, cap - shown).forEach((m) => {
        shown++;
        const li = document.createElement("li");
        li.className = "ctx-memory-item";
        li.innerHTML = `
          <div class="ctx-memory-item__body">
            <span class="ctx-memory-item__title">${escape(m.title)}</span>
            <span class="ctx-memory-item__text">${escape(m.body)}</span>
            <span class="ctx-memory-item__source">${escape(sourceLabel(m.source))}</span>
          </div>
          <div class="ctx-memory-item__actions">
            <button type="button" class="ctx-btn ctx-btn--ghost" data-edit="${m.id}">Edit</button>
            <button type="button" class="ctx-btn ctx-btn--danger" data-del="${m.id}">Delete</button>
          </div>`;
        ul.appendChild(li);
      });

      section.appendChild(ul);
      els.contextList.appendChild(section);
    });

    els.contextList.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.edit));
    });
    els.contextList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => deleteMemory(btn.dataset.del));
    });
  }

  function openModal(id) {
    editingId = id || null;
    const m = id
      ? window.LifeAdminContextEngine.getMemories().find((x) => x.id === id)
      : null;

    if (els.contextModalTitle) {
      els.contextModalTitle.textContent = m ? "Edit memory" : "Add memory";
    }
    if (els.fieldMemoryCategory) els.fieldMemoryCategory.value = m?.category || "preferences";
    if (els.fieldMemoryTitle) els.fieldMemoryTitle.value = m?.title || "";
    if (els.fieldMemoryBody) els.fieldMemoryBody.value = m?.body || "";
    els.contextModal?.showModal?.();
  }

  async function deleteMemory(id) {
    if (!confirm("Delete this memory?")) return;
    await window.LifeAdminContextEngine.deleteMemory(id);
    await window.LifeAdminContextEngine.loadMemories();
    render();
    handlers.onContextChanged?.();
  }

  async function handleSave(e) {
    e.preventDefault();
    const title = els.fieldMemoryTitle?.value?.trim();
    const body = els.fieldMemoryBody?.value?.trim();
    if (!title) {
      alert("Please enter a title.");
      return;
    }

    const existing = editingId
      ? window.LifeAdminContextEngine.getMemories().find((x) => x.id === editingId)
      : null;

    await window.LifeAdminContextEngine.saveMemory({
      id: editingId || undefined,
      category: els.fieldMemoryCategory?.value || "preferences",
      title,
      body,
      source: existing?.source === "family_sync" ? "family_sync" : "user",
      memoryKey: existing?.memoryKey || "",
      meta: existing?.meta || {},
      createdAt: existing?.createdAt,
    });

    els.contextModal?.close?.();
    await window.LifeAdminContextEngine.loadMemories();
    render();
    handlers.onContextChanged?.();
  }

  function init(dom, h = {}) {
    els = { ...dom };
    handlers = h;

    els.btnAddMemory?.addEventListener("click", () => openModal(null));
    els.contextModalClose?.addEventListener("click", () => els.contextModal?.close?.());
    els.contextForm?.addEventListener("submit", handleSave);
  }

  window.LifeAdminContextUI = {
    init,
    render,
  };
})();
