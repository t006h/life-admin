/**
 * Life Admin — Today tab (upcoming timeline; briefing handled separately)
 */
(function () {
  const MAX_VISIBLE = 5;

  const PLACEHOLDER_UPCOMING = [
    { dayLabel: "Tomorrow", text: "Netflix renews", icon: "💳", kind: "placeholder" },
    { dayLabel: "Fri", text: "School form deadline", icon: "⚠", kind: "placeholder" },
  ];

  function categoryIcon(category) {
    if (category === "subscriptions" || category === "bills") return "💳";
    return "⚠";
  }

  function buildTimeline(allItems) {
    const inWeek = allItems
      .filter((i) => i.days >= 0 && i.days <= 7)
      .sort((a, b) => a.days - b.days);

    const live = inWeek.map((item) => {
      const d = new Date();
      d.setDate(d.getDate() + item.days);
      const dayLabel =
        item.days === 0
          ? "Today"
          : item.days === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-GB", { weekday: "short" });
      return {
        dayLabel,
        text: item.title,
        icon: categoryIcon(item.category),
        kind: "live",
        category: item.category,
        id: item.id,
        days: item.days,
      };
    });

    const merged = [...live];
    for (const p of PLACEHOLDER_UPCOMING) {
      if (merged.length >= MAX_VISIBLE) break;
      merged.push(p);
    }
    return merged.slice(0, MAX_VISIBLE);
  }

  function capList(listEl, count) {
    listEl.classList.toggle("today-list--scroll", count > MAX_VISIBLE);
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function timelineRow(entry, onOpen) {
    const li = document.createElement("li");
    li.className = "timeline-item";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "timeline-btn";
    btn.innerHTML = `
      <span class="timeline-day">${escape(entry.dayLabel)}</span>
      <span class="timeline-line">
        <span aria-hidden="true">${entry.icon}</span>
        <span>${escape(entry.text)}</span>
      </span>
    `;
    if (entry.id && onOpen) btn.addEventListener("click", () => onOpen(entry.category, entry.id));
    else if (entry.kind === "placeholder") btn.addEventListener("click", () => alert("Coming soon — family calendar sync."));
    li.appendChild(btn);
    return li;
  }

  function renderUpcoming({ els, allItems, onOpenItem }) {
    const timeline = buildTimeline(
      allItems.filter((i) => window.LifeAdminAccess?.canAccessCategory(i.category))
    );
    els.upcomingList.replaceChildren();
    if (timeline.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-line";
      li.textContent = "Nothing scheduled in the next 7 days.";
      els.upcomingList.appendChild(li);
    } else {
      for (const entry of timeline) {
        els.upcomingList.appendChild(timelineRow(entry, onOpenItem));
      }
    }
    capList(els.upcomingList, timeline.length);
  }

  function formatDate(dateStr) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function linkedDocRow(entry, onOpenVault) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `linked-doc-row linked-doc-row--${entry.status}`;
    btn.dataset.vaultDoc = entry.id;
    btn.innerHTML = `
      <span class="linked-doc-row__icon" aria-hidden="true">${entry.icon}</span>
      <span class="linked-doc-row__body">
        <span class="linked-doc-row__title">${escape(entry.title)}</span>
        <span class="linked-doc-row__meta">${escape(entry.categoryLabel)} · ${escape(formatDate(entry.expiryDate))}</span>
        ${entry.alertLine ? `<span class="linked-doc-row__alert">${escape(entry.alertLine)}</span>` : ""}
      </span>
      <span class="linked-doc-row__chev" aria-hidden="true">›</span>`;
    btn.addEventListener("click", () => onOpenVault?.(entry.id));
    li.appendChild(btn);
    return li;
  }

  function renderLinkedDocuments({ els, documents, onOpenVault }) {
    if (!els.linkedDocsList) return;
    const entries = window.LifeAdminVaultIntelligence?.getDocumentsForToday?.(documents || []) || [];
    els.linkedDocsList.replaceChildren();

    if (els.linkedDocsCard) {
      els.linkedDocsCard.hidden = entries.length === 0;
    }

    if (entries.length === 0) {
      if (els.linkedDocsEmpty) els.linkedDocsEmpty.hidden = true;
      return;
    }

    if (els.linkedDocsEmpty) els.linkedDocsEmpty.hidden = true;
    for (const entry of entries) {
      els.linkedDocsList.appendChild(linkedDocRow(entry, onOpenVault));
    }
  }

  function renderDailyTimeline({ els, entries, onOpenBlock }) {
    if (!els.dailyTimelineList) return;
    els.dailyTimelineList.replaceChildren();
    if (!entries?.length) {
      if (els.dailyTimelineCard) els.dailyTimelineCard.hidden = true;
      return;
    }
    if (els.dailyTimelineCard) els.dailyTimelineCard.hidden = false;
    entries.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "daily-timeline-item";
      const btn = document.createElement(entry.blockId ? "button" : "div");
      if (entry.blockId) {
        btn.type = "button";
        btn.className = "daily-timeline-row daily-timeline-row--btn";
        btn.addEventListener("click", () => onOpenBlock?.(entry.blockId));
      } else {
        btn.className = "daily-timeline-row";
      }
      btn.innerHTML = `
        <span class="daily-timeline-row__time">${escape(entry.time)}${entry.endTime ? ` – ${escape(entry.endTime)}` : ""}</span>
        <span class="daily-timeline-row__line">
          <span class="daily-timeline-row__icon" aria-hidden="true">${entry.icon || "•"}</span>
          <span class="daily-timeline-row__title">${escape(entry.title)}</span>
        </span>`;
      li.appendChild(btn);
      els.dailyTimelineList.appendChild(li);
    });
  }

  window.LifeAdminToday = {
    MAX_VISIBLE,
    buildTimeline,
    renderUpcoming,
    renderLinkedDocuments,
    renderDailyTimeline,
  };
})();
