/**
 * Life Admin — Today tab OS layer (family overview, quick actions, reminders strip)
 */
(function () {
  const CAP = () => window.LifeAdminOS?.LIST_CAP || 5;

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderFamilyOverview(els, handlers) {
    if (!els.familyOverview) return;
    const members = window.LifeAdminFamily?.getMembers?.() || [];
    const canFamily = window.LifeAdminFamily?.canUseFamily?.() ?? false;

    if (!canFamily || !members.length) {
      els.familyOverview.hidden = true;
      return;
    }

    els.familyOverview.hidden = false;
    els.familyList.replaceChildren();

    const shown = members.slice(0, CAP());
    shown.forEach((m) => {
      const role = window.LifeAdminFamily?.ROLES?.[m.role]?.label || m.role;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "os-family-chip";
      chip.innerHTML = `
        <span class="os-family-chip__avatar os-family-chip__avatar--${escape(m.avatarColor || "teal")}">${escape(m.name.slice(0, 1))}</span>
        <span class="os-family-chip__name">${escape(m.name)}</span>
        <span class="os-family-chip__role">${escape(role)}</span>`;
      chip.addEventListener("click", () => handlers.onOpenFamily?.());
      els.familyList.appendChild(chip);
    });

    if (members.length > CAP() && els.familyMore) {
      els.familyMore.hidden = false;
      els.familyMore.textContent = `+${members.length - CAP()} more`;
      els.familyMore.onclick = () => handlers.onOpenFamily?.();
    } else if (els.familyMore) {
      els.familyMore.hidden = true;
    }
  }

  function renderQuickActions(els, handlers) {
    if (!els.quickActions) return;
    els.quickActions.replaceChildren();

    const actions = [
      { id: "brain", icon: "💡", label: "Brain dump", run: () => handlers.onBrainDump?.() },
      { id: "task", icon: "✓", label: "Add task", run: () => handlers.onAddTask?.() },
      { id: "reminder", icon: "🔔", label: "Reminder", run: () => handlers.onAddReminder?.() },
      { id: "family", icon: "👨‍👩‍👧", label: "Family", run: () => handlers.onOpenFamily?.() },
    ];

    actions.slice(0, 4).forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "os-quick-chip";
      btn.innerHTML = `<span aria-hidden="true">${a.icon}</span>${escape(a.label)}`;
      btn.addEventListener("click", a.run);
      els.quickActions.appendChild(btn);
    });
  }

  function renderRemindersStrip(els, notifications, handlers) {
    if (!els.remindersStrip || !els.remindersList) return;
    const items = (notifications || []).slice(0, CAP());
    els.remindersList.replaceChildren();

    if (!items.length) {
      els.remindersStrip.hidden = true;
      return;
    }

    els.remindersStrip.hidden = false;
    items.forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "os-reminder-pill";
      const urgent = item.urgency === "urgent" || item.days <= 3;
      btn.classList.toggle("os-reminder-pill--urgent", urgent);
      btn.innerHTML = `<span class="os-reminder-pill__icon" aria-hidden="true">${urgent ? "⚠" : "🔔"}</span>
        <span class="os-reminder-pill__text">${escape(item.title)}</span>`;
      btn.addEventListener("click", () => handlers.onOpenReminder?.(item.category, item.id));
      li.appendChild(btn);
      els.remindersList.appendChild(li);
    });

    const total = notifications?.length || 0;
    if (els.remindersMore && total > CAP()) {
      els.remindersMore.hidden = false;
      els.remindersMore.textContent = `View all (${total})`;
      els.remindersMore.onclick = () => handlers.onOpenNotifications?.();
    } else if (els.remindersMore) {
      els.remindersMore.hidden = true;
    }
  }

  function render(els, data, handlers) {
    renderQuickActions(els, handlers);
    renderRemindersStrip(els, data.notifications, handlers);
  }

  let dom = {};
  let h = {};

  function init(d, handlers) {
    dom = d || {};
    h = handlers || {};
  }

  window.LifeAdminTodayOS = {
    init,
    render: (data) => render(dom, data, h),
  };
})();
