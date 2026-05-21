/**
 * Life Admin — admin panel placeholders (no billing, no live analytics).
 */
(function () {
  const ANALYTICS_TABLE = "analytics_placeholders";

  async function loadAnalyticsPlaceholders() {
    const client = window.supabaseClient;
    if (!client || !window.LifeAdminAccess.isAdmin()) return [];

    const { data, error } = await client.from(ANALYTICS_TABLE).select("*").order("id");
    if (error) {
      console.warn("Analytics placeholders unavailable:", error);
      return getStaticPlaceholders();
    }
    return data && data.length ? data : getStaticPlaceholders();
  }

  function getStaticPlaceholders() {
    return [
      { id: "active_users", label: "Active users", description: "Placeholder metric" },
      { id: "reminders_due", label: "Reminders due", description: "Placeholder metric" },
      { id: "plan_distribution", label: "Plan distribution", description: "Placeholder metric" },
      { id: "upgrade_funnel", label: "Upgrade funnel", description: "Placeholder metric" },
    ];
  }

  function renderAdminPanel(container, analytics) {
    if (!container) return;

    const caps = window.LifeAdminAccess.CAPABILITIES;
    const canManageUsers = window.LifeAdminAccess.hasCapability(caps.ADMIN_MANAGE_USERS);
    const canManagePlans = window.LifeAdminAccess.hasCapability(caps.ADMIN_MANAGE_PLANS);
    const canAnalytics = window.LifeAdminAccess.hasCapability(caps.ADMIN_ANALYTICS);

    container.innerHTML = `
      <header class="admin-panel__header">
        <h3 class="admin-panel__title">Admin</h3>
        <p class="admin-panel__subtitle">Management &amp; analytics placeholders</p>
      </header>
      <div class="admin-panel__sections">
        ${
          canManageUsers
            ? `<section class="admin-panel__section">
                <h4>Manage users</h4>
                <p class="admin-panel__placeholder">User list &amp; role editor — coming soon</p>
              </section>`
            : ""
        }
        ${
          canManagePlans
            ? `<section class="admin-panel__section">
                <h4>Manage plans</h4>
                <p class="admin-panel__placeholder">Plan assignment UI — coming soon (no billing)</p>
              </section>`
            : ""
        }
        ${
          canAnalytics
            ? `<section class="admin-panel__section">
                <h4>Analytics</h4>
                <ul class="admin-panel__metrics">
                  ${analytics
                    .map(
                      (m) =>
                        `<li><strong>${escape(m.label)}</strong><span>${escape(m.description)}</span></li>`
                    )
                    .join("")}
                </ul>
              </section>`
            : ""
        }
        <section class="admin-panel__section">
          <h4>Discount codes</h4>
          <p class="admin-panel__placeholder">Founder / admin only — not visible to users</p>
          <ul class="admin-panel__metrics">
            <li><strong>EARLY100</strong><span>100% · Once · max 100</span></li>
            <li><strong>FAMILY50</strong><span>50% · 3 months</span></li>
            <li><strong>LIFETIME20</strong><span>20% · Forever</span></li>
          </ul>
          <p class="admin-panel__placeholder">Fields: code, type (%, fixed, trial), duration, max uses, expiry</p>
        </section>
      </div>
    `;
  }

  function escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  async function initAdminPanel(containerEl) {
    if (!containerEl || !window.LifeAdminAccess.isAdmin()) {
      if (containerEl) containerEl.hidden = true;
      return;
    }
    containerEl.hidden = false;
    const analytics = await loadAnalyticsPlaceholders();
    renderAdminPanel(containerEl, analytics);
  }

  window.LifeAdminAdmin = {
    initAdminPanel,
    loadAnalyticsPlaceholders,
  };
})();
