/**
 * Life Admin — Family Management v1 (members, reminders, shared tasks)
 */
(function () {
  const MEMBERS_TABLE = "life_admin_family_members";
  const REMINDERS_TABLE = "life_admin_family_reminders";
  const LS_MEMBERS = "life_admin_family_members";
  const LS_REMINDERS = "life_admin_family_reminders";

  const ROLES = Object.freeze({
    parent: { label: "Parent", icon: "👤", color: "teal" },
    child: { label: "Child", icon: "👧", color: "purple" },
    partner: { label: "Partner", icon: "💑", color: "pink" },
    caregiver: { label: "Caregiver", icon: "🩺", color: "blue" },
    pet: { label: "Pet", icon: "🐾", color: "orange" },
  });

  const FEATURE = () => window.LifeAdminAccess?.FEATURES?.FAMILY_MANAGEMENT || "family.management";

  let members = [];
  let reminders = [];
  let els = {};
  let useLocalFallback = false;
  let editingMemberId = null;
  let editingReminderId = null;

  function getClient() {
    return window.supabaseClient;
  }

  function canUseFamily() {
    return window.LifeAdminAccess?.canAccess?.(FEATURE()) ?? true;
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0][0] || "?").toUpperCase();
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function formatDue(dateStr) {
    if (!dateStr) return "No date";
    const today = startOfDay(new Date());
    const due = startOfDay(new Date(dateStr + "T12:00:00"));
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return `${Math.abs(days)}d ago`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 7) return due.toLocaleDateString("en-GB", { weekday: "long" });
    return due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function rowToMember(row) {
    return {
      id: row.id,
      name: row.name || "",
      relationship: row.relationship || "",
      dateOfBirth: row.date_of_birth || "",
      role: row.role || "parent",
      avatarColor: row.avatar_color || ROLES[row.role]?.color || "teal",
    };
  }

  function memberToRow(m) {
    return {
      id: m.id,
      name: m.name,
      relationship: m.relationship || "",
      date_of_birth: m.dateOfBirth || null,
      role: m.role,
      avatar_color: m.avatarColor || ROLES[m.role]?.color || "teal",
      updated_at: new Date().toISOString(),
    };
  }

  function rowToReminder(row) {
    return {
      id: row.id,
      memberId: row.member_id || null,
      title: row.title || "",
      dueDate: row.due_date || "",
      severity: row.severity || "warning",
    };
  }

  function reminderToRow(r) {
    return {
      id: r.id,
      member_id: r.memberId || null,
      title: r.title,
      due_date: r.dueDate,
      severity: r.severity || "warning",
      updated_at: new Date().toISOString(),
    };
  }

  function loadLocal(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocal(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function defaultSeed() {
    const partnerId = crypto.randomUUID();
    const childId = crypto.randomUUID();
    const petId = crypto.randomUUID();
    const friday = new Date();
    const day = friday.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    friday.setDate(friday.getDate() + daysUntilFriday);
    const fridayStr = friday.toISOString().slice(0, 10);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const passportDue = new Date();
    passportDue.setMonth(passportDue.getMonth() + 8);

    return {
      members: [
        {
          id: partnerId,
          name: "Alex",
          relationship: "Partner",
          dateOfBirth: "",
          role: "partner",
          avatarColor: "pink",
        },
        {
          id: childId,
          name: "Mia",
          relationship: "Daughter",
          dateOfBirth: "2016-04-12",
          role: "child",
          avatarColor: "purple",
        },
        {
          id: petId,
          name: "Buddy",
          relationship: "Dog",
          dateOfBirth: "",
          role: "pet",
          avatarColor: "orange",
        },
      ],
      reminders: [
        {
          id: crypto.randomUUID(),
          memberId: childId,
          title: "School trip Friday",
          dueDate: fridayStr,
          severity: "warning",
        },
        {
          id: crypto.randomUUID(),
          memberId: petId,
          title: "Dog vaccination next month",
          dueDate: nextMonth.toISOString().slice(0, 10),
          severity: "info",
        },
        {
          id: crypto.randomUUID(),
          memberId: childId,
          title: "Child passport expires",
          dueDate: passportDue.toISOString().slice(0, 10),
          severity: "urgent",
        },
      ],
    };
  }

  async function loadMembers() {
    const client = getClient();
    if (!client) {
      useLocalFallback = true;
      members = loadLocal(LS_MEMBERS);
      if (!members.length) {
        const seed = defaultSeed();
        members = seed.members;
        saveLocal(LS_MEMBERS, members);
        if (!loadLocal(LS_REMINDERS).length) {
          reminders = seed.reminders;
          saveLocal(LS_REMINDERS, reminders);
        }
      }
      return members;
    }
    try {
      const { data, error } = await client
        .from(MEMBERS_TABLE)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      members = (data || []).map(rowToMember);
      if (!members.length) await seedIfEmpty();
      return members;
    } catch (err) {
      console.warn("Family members: local fallback", err.message);
      useLocalFallback = true;
      members = loadLocal(LS_MEMBERS);
      if (!members.length) {
        const seed = defaultSeed();
        members = seed.members;
        saveLocal(LS_MEMBERS, members);
      }
      return members;
    }
  }

  async function loadReminders() {
    const client = getClient();
    if (!client || useLocalFallback) {
      reminders = loadLocal(LS_REMINDERS);
      if (!reminders.length && members.length) {
        const seed = defaultSeed();
        reminders = seed.reminders;
        saveLocal(LS_REMINDERS, reminders);
      }
      return reminders;
    }
    try {
      const { data, error } = await client
        .from(REMINDERS_TABLE)
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      reminders = (data || []).map(rowToReminder);
      if (!reminders.length && members.length) await seedIfEmpty();
      return reminders;
    } catch (err) {
      console.warn("Family reminders: local fallback", err.message);
      useLocalFallback = true;
      reminders = loadLocal(LS_REMINDERS);
      return reminders;
    }
  }

  async function seedIfEmpty() {
    if (members.length || !getClient()) return;
    const seed = defaultSeed();
    for (const m of seed.members) {
      await persistMember(m);
    }
    members = seed.members;
    for (const r of seed.reminders) {
      await persistReminder(r);
    }
    reminders = seed.reminders;
  }

  async function persistMember(member) {
    if (useLocalFallback || !getClient()) {
      const idx = members.findIndex((m) => m.id === member.id);
      if (idx >= 0) members[idx] = member;
      else members.push(member);
      saveLocal(LS_MEMBERS, members);
      return member;
    }
    const { error } = await getClient().from(MEMBERS_TABLE).upsert(memberToRow(member));
    if (error) throw error;
    return member;
  }

  async function persistReminder(reminder) {
    if (useLocalFallback || !getClient()) {
      const idx = reminders.findIndex((r) => r.id === reminder.id);
      if (idx >= 0) reminders[idx] = reminder;
      else reminders.push(reminder);
      saveLocal(LS_REMINDERS, reminders);
      return reminder;
    }
    const { error } = await getClient().from(REMINDERS_TABLE).upsert(reminderToRow(reminder));
    if (error) throw error;
    return reminder;
  }

  async function deleteMember(id) {
    if (useLocalFallback || !getClient()) {
      members = members.filter((m) => m.id !== id);
      reminders = reminders.filter((r) => r.memberId !== id);
      saveLocal(LS_MEMBERS, members);
      saveLocal(LS_REMINDERS, reminders);
      return;
    }
    await getClient().from(MEMBERS_TABLE).delete().eq("id", id);
    members = members.filter((m) => m.id !== id);
    reminders = reminders.filter((r) => r.memberId !== id);
  }

  async function deleteReminder(id) {
    if (useLocalFallback || !getClient()) {
      reminders = reminders.filter((r) => r.id !== id);
      saveLocal(LS_REMINDERS, reminders);
      return;
    }
    await getClient().from(REMINDERS_TABLE).delete().eq("id", id);
    reminders = reminders.filter((r) => r.id !== id);
  }

  async function loadAll() {
    await loadMembers();
    await loadReminders();
    return { members, reminders };
  }

  function getMembers() {
    return members;
  }

  function getReminders() {
    return reminders;
  }

  function getSharedTasks() {
    const tasks = window.LifeAdminTasks?.getTasks?.() || [];
    return tasks.filter(
      (t) =>
        t.assignedTo === "partner" ||
        t.assignedTo === "child" ||
        t.assignedTo === "everyone" ||
        t.category === "family"
    );
  }

  function memberById(id) {
    return members.find((m) => m.id === id);
  }

  function renderMemberRow(member) {
    const role = ROLES[member.role] || ROLES.parent;
    const li = document.createElement("li");
    li.className = "family-member-row";
    li.innerHTML = `
      <span class="family-avatar family-avatar--${escape(member.avatarColor || role.color)}" aria-hidden="true">${escape(initials(member.name))}</span>
      <span class="family-member-row__body">
        <span class="family-member-row__name">${escape(member.name)}</span>
        <span class="family-member-row__meta">${escape(role.icon)} ${escape(role.label)}${member.relationship ? ` · ${escape(member.relationship)}` : ""}</span>
        ${member.dateOfBirth ? `<span class="family-member-row__dob">DOB ${escape(new Date(member.dateOfBirth + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</span>` : ""}
      </span>
      <button type="button" class="family-member-row__edit" aria-label="Edit ${escape(member.name)}">Edit</button>`;
    li.querySelector(".family-member-row__edit").addEventListener("click", () => openMemberModal(member.id));
    return li;
  }

  function renderReminderRow(reminder) {
    const member = reminder.memberId ? memberById(reminder.memberId) : null;
    const icon = reminder.severity === "urgent" ? "⚠️" : reminder.severity === "info" ? "ℹ️" : "⚠";
    const li = document.createElement("li");
    li.className = `family-reminder-row family-reminder-row--${reminder.severity}`;
    li.innerHTML = `
      <span class="family-reminder-row__icon" aria-hidden="true">${icon}</span>
      <span class="family-reminder-row__body">
        <span class="family-reminder-row__title">${escape(reminder.title)}</span>
        <span class="family-reminder-row__meta">${escape(formatDue(reminder.dueDate))}${member ? ` · ${escape(member.name)}` : ""}</span>
      </span>`;
    li.addEventListener("click", () => openReminderModal(reminder.id));
    return li;
  }

  function renderSharedTaskRow(task) {
    const assignLabel =
      window.LifeAdminTasks?.ASSIGN_LABELS?.[task.assignedTo] || task.assignedTo || "Me";
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "family-task-row";
    btn.innerHTML = `
      <span class="family-task-row__assign">${escape(assignLabel)}</span>
      <span class="family-task-row__body">
        <span class="family-task-row__title">${escape(task.title)}</span>
        <span class="family-task-row__meta">${task.dueDate ? escape(formatDue(task.dueDate)) : "No due date"}</span>
      </span>
      <span class="family-task-row__chev" aria-hidden="true">›</span>`;
    btn.addEventListener("click", () => window.LifeAdminTasks?.openEditModal?.(task.id));
    li.appendChild(btn);
    return li;
  }

  function renderInsights() {
    if (!els.familyInsightsList) return;
    const insightItems = window.LifeAdminFamilyInsights.generateInsights({
      members,
      reminders,
      tasks: window.LifeAdminTasks?.getTasks?.() || [],
    });
    els.familyInsightsList.replaceChildren();
    insightItems.forEach((item) => {
      const li = document.createElement("li");
      li.className = "family-insight-row";
      li.innerHTML = `
        <span class="family-insight-row__icon" aria-hidden="true">${item.icon}</span>
        <span class="family-insight-row__body">
          <span class="family-insight-row__text">${escape(item.text)}</span>
          ${item.sub ? `<span class="family-insight-row__sub">${escape(item.sub)}</span>` : ""}
        </span>`;
      els.familyInsightsList.appendChild(li);
    });
  }

  function renderFamily() {
    if (!canUseFamily()) {
      if (els.familyUpgradeCard) els.familyUpgradeCard.hidden = false;
      if (els.familyContent) els.familyContent.hidden = true;
      if (els.familyFabDock) els.familyFabDock.hidden = true;
      return;
    }
    if (els.familyUpgradeCard) els.familyUpgradeCard.hidden = true;
    if (els.familyContent) els.familyContent.hidden = false;

    if (els.familyMemberList) {
      els.familyMemberList.replaceChildren();
      if (members.length === 0) {
        if (els.familyMembersEmpty) els.familyMembersEmpty.hidden = false;
      } else {
        if (els.familyMembersEmpty) els.familyMembersEmpty.hidden = true;
        members.forEach((m) => els.familyMemberList.appendChild(renderMemberRow(m)));
      }
    }

    const sortedReminders = [...reminders].sort((a, b) =>
      (a.dueDate || "").localeCompare(b.dueDate || "")
    );
    if (els.familyReminderList) {
      els.familyReminderList.replaceChildren();
      if (sortedReminders.length === 0) {
        if (els.familyRemindersEmpty) els.familyRemindersEmpty.hidden = false;
      } else {
        if (els.familyRemindersEmpty) els.familyRemindersEmpty.hidden = true;
        sortedReminders.forEach((r) =>
          els.familyReminderList.appendChild(renderReminderRow(r))
        );
      }
    }

    const shared = getSharedTasks();
    if (els.familyTaskList) {
      els.familyTaskList.replaceChildren();
      if (shared.length === 0) {
        if (els.familyTasksEmpty) els.familyTasksEmpty.hidden = false;
      } else {
        if (els.familyTasksEmpty) els.familyTasksEmpty.hidden = true;
        shared.forEach((t) => els.familyTaskList.appendChild(renderSharedTaskRow(t)));
      }
    }

    renderInsights();
  }

  function fillMemberForm(member) {
    els.fieldMemberId.value = member?.id || "";
    els.fieldMemberName.value = member?.name || "";
    els.fieldMemberRelationship.value = member?.relationship || "";
    els.fieldMemberDob.value = member?.dateOfBirth || "";
    els.fieldMemberRole.value = member?.role || "parent";
  }

  function readMemberForm() {
    const role = els.fieldMemberRole.value;
    return {
      id: els.fieldMemberId.value || crypto.randomUUID(),
      name: els.fieldMemberName.value.trim(),
      relationship: els.fieldMemberRelationship.value.trim(),
      dateOfBirth: els.fieldMemberDob.value,
      role,
      avatarColor: ROLES[role]?.color || "teal",
    };
  }

  function openMemberModal(id) {
    editingMemberId = id || null;
    const member = id ? memberById(id) : null;
    els.familyMemberModalTitle.textContent = member ? "Edit family member" : "Add family member";
    fillMemberForm(member);
    if (els.btnMemberDelete) els.btnMemberDelete.hidden = !member;
    els.familyMemberModal.showModal();
    els.fieldMemberName.focus();
  }

  function fillReminderForm(reminder) {
    els.fieldReminderId.value = reminder?.id || "";
    els.fieldReminderTitle.value = reminder?.title || "";
    els.fieldReminderDue.value = reminder?.dueDate || "";
    els.fieldReminderSeverity.value = reminder?.severity || "warning";
    const opts = members
      .map(
        (m) =>
          `<option value="${m.id}" ${reminder?.memberId === m.id ? "selected" : ""}>${escape(m.name)}</option>`
      )
      .join("");
    els.fieldReminderMember.innerHTML = `<option value="">Household (general)</option>${opts}`;
    els.fieldReminderMember.value = reminder?.memberId || "";
  }

  function readReminderForm() {
    return {
      id: els.fieldReminderId.value || crypto.randomUUID(),
      memberId: els.fieldReminderMember.value || null,
      title: els.fieldReminderTitle.value.trim(),
      dueDate: els.fieldReminderDue.value,
      severity: els.fieldReminderSeverity.value,
    };
  }

  function openReminderModal(id) {
    editingReminderId = id || null;
    const reminder = id ? reminders.find((r) => r.id === id) : null;
    els.familyReminderModalTitle.textContent = reminder ? "Edit reminder" : "Add family reminder";
    fillReminderForm(reminder);
    if (els.btnReminderDelete) els.btnReminderDelete.hidden = !reminder;
    els.familyReminderModal.showModal();
    els.fieldReminderTitle.focus();
  }

  function setFamilyFabOpen(open) {
    if (!els.familyFabAdd) return;
    els.familyFabAdd.classList.toggle("is-open", open);
    els.familyFabAdd.setAttribute("aria-expanded", open ? "true" : "false");
  }

  async function handleMemberSave(e) {
    e.preventDefault();
    const member = readMemberForm();
    if (!member.name) return;
    els.btnMemberSave.disabled = true;
    try {
      await persistMember(member);
      const idx = members.findIndex((m) => m.id === member.id);
      if (idx >= 0) members[idx] = member;
      else members.push(member);
      els.familyMemberModal.close();
      renderFamily();
    } catch (err) {
      alert(`Could not save member: ${err.message}`);
    } finally {
      els.btnMemberSave.disabled = false;
    }
  }

  async function handleMemberDelete() {
    if (!editingMemberId || !confirm("Remove this family member?")) return;
    try {
      await deleteMember(editingMemberId);
      els.familyMemberModal.close();
      renderFamily();
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
    }
  }

  async function handleReminderSave(e) {
    e.preventDefault();
    const reminder = readReminderForm();
    if (!reminder.title || !reminder.dueDate) return;
    els.btnReminderSave.disabled = true;
    try {
      await persistReminder(reminder);
      const idx = reminders.findIndex((r) => r.id === reminder.id);
      if (idx >= 0) reminders[idx] = reminder;
      else reminders.push(reminder);
      els.familyReminderModal.close();
      renderFamily();
    } catch (err) {
      alert(`Could not save reminder: ${err.message}`);
    } finally {
      els.btnReminderSave.disabled = false;
    }
  }

  async function handleReminderDelete() {
    if (!editingReminderId || !confirm("Delete this reminder?")) return;
    try {
      await deleteReminder(editingReminderId);
      els.familyReminderModal.close();
      renderFamily();
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
    }
  }

  async function init(dom) {
    els = { ...dom };
    if (els.fieldMemberRole) {
      els.fieldMemberRole.innerHTML = Object.entries(ROLES)
        .map(([value, cfg]) => `<option value="${value}">${cfg.label}</option>`)
        .join("");
    }

    els.familyFabAdd?.addEventListener("click", () => openMemberModal());
    els.btnAddFamilyReminder?.addEventListener("click", () => openReminderModal());
    els.btnAddFamilyTask?.addEventListener("click", () => {
      window.LifeAdminTasks?.openAddModal?.();
      const sel = document.getElementById("fieldTaskAssignedTo");
      if (sel) sel.value = "partner";
    });

    els.familyMemberForm?.addEventListener("submit", handleMemberSave);
    els.familyMemberClose?.addEventListener("click", () => els.familyMemberModal?.close());
    els.familyMemberModal?.addEventListener("click", (e) => {
      if (e.target === els.familyMemberModal) els.familyMemberModal.close();
    });
    els.btnMemberDelete?.addEventListener("click", handleMemberDelete);

    els.familyReminderForm?.addEventListener("submit", handleReminderSave);
    els.familyReminderClose?.addEventListener("click", () => els.familyReminderModal?.close());
    els.familyReminderModal?.addEventListener("click", (e) => {
      if (e.target === els.familyReminderModal) els.familyReminderModal.close();
    });
    els.btnReminderDelete?.addEventListener("click", handleReminderDelete);

    if (els.familyUpgradeText) {
      els.familyUpgradeText.textContent =
        window.LifeAdminAccess?.getUpgradeMessage?.(FEATURE()) ||
        "Upgrade to Family Premium to manage your household.";
    }
  }

  async function createReminderQuick({ title, dueDate }) {
    const reminder = {
      id: crypto.randomUUID(),
      memberId: null,
      title: title || "Family reminder",
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
      severity: "warning",
    };
    await persistReminder(reminder);
    const idx = reminders.findIndex((r) => r.id === reminder.id);
    if (idx >= 0) reminders[idx] = reminder;
    else reminders.push(reminder);
    return reminder;
  }

  window.LifeAdminFamily = {
    ROLES,
    init,
    loadAll,
    getMembers,
    getReminders,
    getSharedTasks,
    renderFamily,
    canUseFamily,
    setFamilyFabOpen,
    openMemberModal,
    openReminderModal,
    createReminderQuick,
  };
})();
