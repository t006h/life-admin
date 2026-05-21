/**
 * Life Admin — rules-based family insights (no external AI)
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

  function generateInsights({ members, reminders, tasks }) {
    const insights = [];
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekReminders = (reminders || []).filter((r) => {
      const d = daysUntil(r.dueDate);
      return d != null && d >= 0 && d <= 7;
    });
    const weekTasks = (tasks || []).filter((t) => {
      const d = daysUntil(t.dueDate);
      return d != null && d >= 0 && d <= 7 && t.assignedTo && t.assignedTo !== "me";
    });
    const weekLoad = weekReminders.length + weekTasks.length;

    if (weekLoad >= 3) {
      insights.push({
        icon: "📅",
        text: "You have a busy family week ahead",
        sub: `${weekLoad} reminders and shared tasks in the next 7 days`,
      });
    } else if (weekLoad > 0) {
      insights.push({
        icon: "✨",
        text: "A manageable family week",
        sub: `${weekLoad} item${weekLoad === 1 ? "" : "s"} coming up soon`,
      });
    }

    const overdue = (reminders || []).filter((r) => {
      const d = daysUntil(r.dueDate);
      return d != null && d < 0;
    });
    if (overdue.length) {
      insights.push({
        icon: "⚠️",
        text: `${overdue.length} family reminder${overdue.length === 1 ? "" : "s"} overdue`,
        sub: overdue[0].title,
      });
    }

    const pets = (members || []).filter((m) => m.role === "pet");
    const petReminders = (reminders || []).filter((r) => {
      const member = members.find((m) => m.id === r.memberId);
      return member?.role === "pet" && daysUntil(r.dueDate) != null && daysUntil(r.dueDate) <= 30;
    });
    if (pets.length && petReminders.length) {
      insights.push({
        icon: "🐾",
        text: `Pet care coming up for ${pets[0].name}`,
        sub: petReminders[0].title,
      });
    }

    const children = (members || []).filter((m) => m.role === "child");
    const schoolish = (reminders || []).filter(
      (r) =>
        /school|trip|form|parents/i.test(r.title) &&
        daysUntil(r.dueDate) != null &&
        daysUntil(r.dueDate) <= 14
    );
    if (children.length && schoolish.length) {
      insights.push({
        icon: "🎒",
        text: "School admin on the horizon",
        sub: schoolish[0].title,
      });
    }

    const passportish = (reminders || []).filter((r) =>
      /passport/i.test(r.title)
    );
    if (passportish.length) {
      const d = daysUntil(passportish[0].dueDate);
      if (d != null && d <= 90) {
        insights.push({
          icon: "🛂",
          text: "Passport renewal to plan",
          sub: passportish[0].title,
        });
      }
    }

    if (!insights.length && (members || []).length) {
      insights.push({
        icon: "💚",
        text: "Your household looks calm",
        sub: "Add reminders when trips, jabs, or renewals come up",
      });
    }

    return insights.slice(0, 4);
  }

  window.LifeAdminFamilyInsights = { generateInsights };
})();
