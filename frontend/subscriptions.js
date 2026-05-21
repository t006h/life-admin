/**
 * Life Admin — subscription UX (soft gates, upgrade prompts; no billing)
 */
(function () {
  const Access = () => window.LifeAdminAccess;

  const FEATURE_COPY = Object.freeze({
    workflows: {
      name: "Workflows",
      premium: true,
      chief: false,
    },
    family_activities: {
      name: "Family activities",
      premium: true,
      chief: false,
    },
    weekly_planning: {
      name: "Weekly planning",
      premium: true,
      chief: false,
    },
    smart_suggestions: {
      name: "Smart suggestions",
      premium: true,
      chief: false,
    },
    vault_unlimited: {
      name: "Unlimited Vault",
      premium: true,
      chief: false,
    },
    book_for_me: {
      name: "Book for me",
      premium: false,
      chief: true,
    },
    draft_for_me: {
      name: "Draft for me",
      premium: false,
      chief: true,
    },
    execute_workflows: {
      name: "Automatic workflow execution",
      premium: false,
      chief: true,
    },
    predictive: {
      name: "Predictive suggestions",
      premium: false,
      chief: true,
    },
    ai_planning: {
      name: "Intelligent planning",
      premium: false,
      chief: true,
    },
  });

  let els = {};

  function planLabel(plan) {
    return Access().getPublicPlanLabel(plan);
  }

  function requiredPlanFor(featureKey) {
    const copy = FEATURE_COPY[featureKey];
    if (!copy) return Access().PLANS.FAMILY_PREMIUM;
    if (copy.chief) return Access().PLANS.AI_CHIEF_OF_STAFF;
    if (copy.premium) return Access().PLANS.FAMILY_PREMIUM;
    return Access().PLANS.FREE;
  }

  function canUse(featureKey) {
    const F = Access().FEATURES;
    const map = {
      workflows: () => Access().canUseWorkflows(),
      family_activities: () => Access().canAccess(F.FAMILY_MANAGEMENT),
      weekly_planning: () => Access().canAccess(F.PLANNING_CALENDAR),
      smart_suggestions: () => Access().canAccess(F.SMART_SUGGESTIONS),
      vault_unlimited: () => Access().canAccess(F.VAULT_UNLIMITED),
      book_for_me: () => Access().canAccess(F.BOOK_FOR_ME),
      draft_for_me: () => Access().canAccess(F.DRAFT_FOR_ME),
      execute_workflows: () => Access().canAccess(F.EXECUTE_WORKFLOWS),
      predictive: () => Access().canAccess(F.PREDICTIVE_SUGGESTIONS),
      ai_planning: () => Access().canAccess(F.AI_PLANNING),
      ai_assistant: () => Access().canAccess(F.AI_ASSISTANT),
    };
    return map[featureKey] ? map[featureKey]() : true;
  }

  function showUpgrade(featureKey) {
    const copy = FEATURE_COPY[featureKey] || { name: "This feature", premium: true, chief: false };
    const need = requiredPlanFor(featureKey);
    const title = els.upgradeTitle || document.getElementById("upgradeModalTitle");
    const body = els.upgradeBody || document.getElementById("upgradeModalBody");
    const premiumList = els.upgradePremiumList || document.getElementById("upgradePremiumList");
    const chiefList = els.upgradeChiefList || document.getElementById("upgradeChiefList");

    if (title) {
      title.textContent = `${copy.name} is available with ${planLabel(need)}`;
    }
    if (body) {
      body.textContent =
        need === Access().PLANS.AI_CHIEF_OF_STAFF
          ? "Upgrade for hands-off execution and personalised context."
          : "Upgrade for family coordination, workflows, and smarter planning.";
    }

    if (premiumList) premiumList.hidden = need === Access().PLANS.AI_CHIEF_OF_STAFF;
    if (chiefList) chiefList.hidden = need !== Access().PLANS.AI_CHIEF_OF_STAFF;

    els.dialog?.showModal?.();
  }

  function hideUpgrade() {
    els.dialog?.close?.();
  }

  /** Run fn if allowed; otherwise show upgrade (no hard block). */
  function withFeature(featureKey, fn, opts = {}) {
    if (canUse(featureKey)) return fn();
    if (opts.silent) return null;
    showUpgrade(featureKey);
    return null;
  }

  function bind() {
    els.upgradeBtn?.addEventListener("click", () => {
      hideUpgrade();
      switchViewProfileUpgrade();
    });
    els.dismissBtn?.addEventListener("click", hideUpgrade);
    els.dialog?.addEventListener("click", (e) => {
      if (e.target === els.dialog) hideUpgrade();
    });
  }

  function switchViewProfileUpgrade() {
    document.getElementById("sideMenu")?.close?.();
    if (window.LifeAdminApp?.openProfile) {
      window.LifeAdminApp.openProfile();
      return;
    }
    window.LifeAdminApp?.switchView?.("profile");
  }

  function init() {
    els = {
      dialog: document.getElementById("upgradeModal"),
      upgradeTitle: document.getElementById("upgradeModalTitle"),
      upgradeBody: document.getElementById("upgradeModalBody"),
      upgradePremiumList: document.getElementById("upgradePremiumList"),
      upgradeChiefList: document.getElementById("upgradeChiefList"),
      upgradeBtn: document.getElementById("upgradeModalUpgrade"),
      dismissBtn: document.getElementById("upgradeModalDismiss"),
    };
    bind();
  }

  window.LifeAdminSubscriptions = {
    init,
    canUse,
    withFeature,
    showUpgrade,
    hideUpgrade,
    FEATURE_COPY,
    requiredPlanFor,
  };
})();
