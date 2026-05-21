/**
 * Life Admin — placeholder AI planning (rules-based, no external AI / no Google Calendar)
 */
(function () {
  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = startOfDay(new Date());
    const due = startOfDay(new Date(dateStr + "T12:00:00"));
    return Math.round((due - today) / 86400000);
  }

  function mondayOfWeek(ref) {
    const d = startOfDay(ref || new Date());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function buildFamilyEvents(ctx) {
    const events = [];
    const members = window.LifeAdminFamily?.getMembers?.() || [];
    const reminders = window.LifeAdminFamily?.getReminders?.() || [];

    for (const r of reminders) {
      const days = daysUntil(r.dueDate);
      if (days == null || days < -1 || days > 60) continue;
      let icon = "📄";
      if (/school|trip|form/i.test(r.title)) icon = "📄";
      else if (/birthday|party/i.test(r.title)) icon = "🎂";
      else if (/holiday|flight|✈|travel/i.test(r.title)) icon = "✈";
      else if (/vaccin|vet|dog|pet/i.test(r.title)) icon = "🐾";

      events.push({
        id: `family-reminder:${r.id}`,
        type: "family",
        icon,
        title: r.title,
        date: r.dueDate,
        days,
        allDay: true,
      });
    }

    const now = new Date();
    for (const m of members) {
      if (!m.dateOfBirth) continue;
      const dob = new Date(m.dateOfBirth + "T12:00:00");
      const bday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (bday < startOfDay(now)) bday.setFullYear(now.getFullYear() + 1);
      const days = daysUntil(isoDate(bday));
      if (days != null && days >= 0 && days <= 21) {
        events.push({
          id: `birthday:${m.id}`,
          type: "family",
          icon: "🎂",
          title: `${m.name}'s birthday`,
          date: isoDate(bday),
          days,
          allDay: true,
        });
      }
    }

    if (!events.some((e) => /holiday/i.test(e.title))) {
      const holiday = addDays(now, 25);
      events.push({
        id: "placeholder:holiday",
        type: "family",
        icon: "✈",
        title: "Holiday in 25 days",
        date: isoDate(holiday),
        days: 25,
        allDay: true,
        placeholder: true,
      });
    }

    return events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }

  /** Full week plan for Planning tab */
  function generateWeekPlan(ctx) {
    const { tasks = [], notifications = [], allItems = [] } = ctx;
    const weekStart = mondayOfWeek();
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const familyEvents = buildFamilyEvents(ctx);

    const familyPriorities = [];
    for (const ev of familyEvents.slice(0, 5)) {
      if (ev.days <= 14) {
        familyPriorities.push({
          icon: ev.icon,
          label: ev.title,
          meta: ev.days === 0 ? "Today" : ev.days === 1 ? "Tomorrow" : `In ${ev.days} days`,
        });
      }
    }

    const priorities = [];
    for (const item of [...notifications].sort((a, b) => a.days - b.days)) {
      if (item.days <= 14) {
        priorities.push({
          rank: priorities.length + 1,
          label: item.title,
          meta: `${item.config?.label || item.category} · ${item.days}d`,
          urgency: item.days <= 7 ? "high" : "medium",
        });
      }
    }
    for (const t of tasks.filter((x) => x.progress < 100 && tDue(x) <= 14)) {
      priorities.push({
        rank: priorities.length + 1,
        label: t.title,
        meta: `Task · ${t.priority}`,
        urgency: t.priority === "high" ? "high" : "medium",
      });
    }

    function tDue(task) {
      return daysUntil(task.dueDate) ?? 99;
    }

    const schedule = [];
    const suggestedBlocks = [];
    let totalMinutes = 0;
    const workloadTasks = tasks.filter((t) => t.progress < 100);

    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const iso = isoDate(d);
      const dayLabel = dayNames[i];
      const dayFamily = familyEvents.filter((e) => e.date === iso);
      const dayTasks = workloadTasks.filter((t) => t.dueDate === iso);
      const dayReminders = allItems.filter((item) => item.dueDate === iso && item.notify);

      const highlights = [
        ...dayFamily.map((e) => `${e.icon} ${e.title}`),
        ...dayTasks.slice(0, 2).map((t) => `✓ ${t.title}`),
        ...dayReminders.slice(0, 1).map((r) => `🔔 ${r.title}`),
      ];

      schedule.push({
        day: dayLabel,
        date: iso,
        summary: highlights.length ? highlights.join(" · ") : "Open for focus time",
        load: dayTasks.length + dayFamily.length,
      });

      let slotHour = 9;
      dayTasks.forEach((t, idx) => {
        const mins = t.estimatedDuration || 45;
        totalMinutes += mins;
        const startH = slotHour + (idx % 2) * 2;
        const endH = startH + Math.ceil(mins / 60);
        const startTime = `${String(startH).padStart(2, "0")}:00:00`;
        const endTime = `${String(Math.min(endH, 20)).padStart(2, "0")}:00:00`;
        suggestedBlocks.push({
          title: t.title,
          blockDate: iso,
          startTime,
          endTime,
          category: t.category || "general",
          priority: t.priority || "medium",
          taskId: t.id,
          source: "ai_plan",
        });
        slotHour = endH;
      });

      dayFamily.forEach((ev, idx) => {
        if (/school|drop/i.test(ev.title)) {
          suggestedBlocks.push({
            title: ev.title.includes("trip") ? "School trip / forms" : "School drop-off",
            blockDate: iso,
            startTime: "08:00:00",
            endTime: "08:30:00",
            category: "family",
            priority: "high",
            source: "ai_plan",
          });
        } else if (ev.icon === "🎂") {
          suggestedBlocks.push({
            title: ev.title,
            blockDate: iso,
            startTime: "17:00:00",
            endTime: "19:00:00",
            category: "family",
            priority: "medium",
            source: "ai_plan",
          });
        }
      });

      if (dayReminders.some((r) => /insurance/i.test(r.title))) {
        suggestedBlocks.push({
          title: "Renew insurance",
          blockDate: iso,
          startTime: "10:00:00",
          endTime: "11:00:00",
          category: "documents",
          priority: "high",
          source: "ai_plan",
        });
      }
    }

    if (!suggestedBlocks.some((b) => /dinner/i.test(b.title))) {
      const fri = isoDate(addDays(weekStart, 4));
      suggestedBlocks.push({
        title: "Family dinner",
        blockDate: fri,
        startTime: "17:00:00",
        endTime: "18:30:00",
        category: "family",
        priority: "medium",
        source: "ai_plan",
      });
    }

    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    let workloadLabel = "Light";
    if (hours >= 8) workloadLabel = "Heavy";
    else if (hours >= 4) workloadLabel = "Moderate";

    return {
      generatedAt: new Date().toISOString(),
      familyPriorities: familyPriorities.slice(0, 6),
      priorities: priorities.slice(0, 8),
      schedule: schedule,
      suggestedBlocks: suggestedBlocks.slice(0, 20),
      workload: {
        hours: hours + suggestedBlocks.length * 0.25,
        label: workloadLabel,
        taskCount: workloadTasks.length,
        familyEventCount: familyEvents.length,
      },
      familyEvents,
    };
  }

  /** Today's timed timeline (blocks + inferred slots) */
  function buildDailyTimeline(ctx, timeBlocks) {
    const today = isoDate(new Date());
    const entries = [];

    for (const b of timeBlocks || []) {
      if (b.blockDate !== today) continue;
      entries.push({
        time: b.startTime.slice(0, 5),
        endTime: b.endTime.slice(0, 5),
        title: b.title,
        icon: blockIcon(b.category),
        kind: "block",
        sort: timeToMinutes(b.startTime),
        blockId: b.id,
      });
    }

    const familyEvents = buildFamilyEvents(ctx).filter((e) => e.date === today);
    for (const ev of familyEvents) {
      if (/school|drop/i.test(ev.title)) {
        entries.push({
          time: "08:00",
          title: ev.title.includes("trip") ? ev.title : "School drop-off",
          icon: "📄",
          kind: "family",
          sort: 480,
        });
      }
    }

    const items = ctx.allItems || [];
    if (
      items.some((i) => /insurance/i.test(i.title) && i.dueDate === today) &&
      !entries.some((e) => /insurance/i.test(e.title))
    ) {
      entries.push({
        time: "10:00",
        title: "Renew insurance",
        icon: "🛡️",
        kind: "reminder",
        sort: 600,
      });
    }

    if (!entries.some((e) => /dinner/i.test(e.title))) {
      entries.push({
        time: "17:00",
        title: "Family dinner",
        icon: "🍽️",
        kind: "placeholder",
        sort: 1020,
      });
    }

    return entries.sort((a, b) => a.sort - b.sort);
  }

  function timeToMinutes(t) {
    const [h, m] = String(t).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function blockIcon(category) {
    const map = {
      family: "👨‍👩‍👧",
      documents: "📄",
      mot: "🚗",
      bills: "💳",
      general: "✓",
    };
    return map[category] || "📅";
  }

  window.LifeAdminPlanningAI = {
    generateWeekPlan,
    buildFamilyEvents,
    buildDailyTimeline,
  };
})();
