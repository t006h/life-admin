/**
 * Life Admin — Analytics placeholders (no external data pipelines)
 */
(function () {
  function computeMetrics(ctx) {
    const tasks = ctx?.tasks || [];
    const allItems = ctx?.allItems || [];
    const workflows = (ctx?.workflows || []).filter((w) => w.status === "active");

    const doneTasks = tasks.filter((t) => (t.progress || 0) >= 100).length;
    const completionRate = tasks.length
      ? Math.round((doneTasks / tasks.length) * 100)
      : 0;

    const overdue = allItems.filter((i) => i.days < 0).length;
    const urgent = allItems.filter((i) => i.days >= 0 && i.days <= 7).length;
    const stress =
      overdue >= 3 ? "high" : overdue >= 1 || urgent >= 5 ? "medium" : "low";

    const familyCount = window.LifeAdminFamily?.getMembers?.()?.length || 0;
    const balance = Math.max(
      35,
      Math.min(95, 78 - overdue * 8 - urgent * 2 + familyCount * 3 + completionRate * 0.1)
    );

    const trends = [
      { month: "Mar", value: 58 },
      { month: "Apr", value: 62 },
      { month: "May", value: completionRate || 64 },
    ];

    return {
      lifeBalance: Math.round(balance),
      completionRate,
      stressIndicator: stress,
      stressLabel:
        stress === "high" ? "Elevated" : stress === "medium" ? "Moderate" : "Calm",
      monthlyTrend: trends[trends.length - 1].value >= trends[0].value ? "Improving" : "Watch",
      trends,
      placeholder: true,
    };
  }

  function render(els, ctx) {
    if (!els?.analyticsCard) return;
    const m = computeMetrics(ctx);

    if (els.lifeBalanceScore) els.lifeBalanceScore.textContent = String(m.lifeBalance);
    if (els.completionRate) els.completionRate.textContent = `${m.completionRate}%`;
    if (els.stressIndicator) {
      els.stressIndicator.textContent = m.stressLabel;
      els.stressIndicator.dataset.level = m.stressIndicator;
    }
    const stressTile = document.getElementById("stressTile");
    if (stressTile) stressTile.dataset.level = m.stressIndicator;
    if (els.monthlyTrend) els.monthlyTrend.textContent = m.monthlyTrend;

    if (els.analyticsTrendBars) {
      els.analyticsTrendBars.replaceChildren();
      const max = Math.max(...m.trends.map((t) => t.value), 1);
      m.trends.forEach((t) => {
        const bar = document.createElement("div");
        bar.className = "os-analytics-bar";
        bar.innerHTML = `
          <span class="os-analytics-bar__fill" style="height:${Math.round((t.value / max) * 100)}%"></span>
          <span class="os-analytics-bar__label">${t.month}</span>`;
        els.analyticsTrendBars.appendChild(bar);
      });
    }
  }

  window.LifeAdminAnalytics = {
    computeMetrics,
    render,
  };
})();
