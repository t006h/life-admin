/**
 * Life Admin — roles, plans, and feature access (no payments).
 *
 * Roles:
 *   user    — subject to plan restrictions
 *   founder — unlimited access + beta + experimental
 *   admin   — manage users/plans + analytics placeholders
 */
(function () {
  const ROLES = Object.freeze({
    USER: "user",
    FOUNDER: "founder",
    ADMIN: "admin",
  });

  const PLANS = Object.freeze({
    FREE: "free",
    FAMILY_PREMIUM: "family_premium",
    AI_CHIEF_OF_STAFF: "ai_chief_of_staff",
  });

  const FEATURES = Object.freeze({
    CATEGORY_MOT: "category.mot",
    CATEGORY_PASSPORT: "category.passport",
    CATEGORY_LICENCE: "category.licence",
    CATEGORY_SUBSCRIPTIONS: "category.subscriptions",
    CATEGORY_BILLS: "category.bills",
    NOTIFICATIONS_BASIC: "notifications.basic",
    NOTIFICATIONS_PRIORITIES: "notifications.priorities",
    DASHBOARD_TODAY: "dashboard.today",
    ITEMS_UNLIMITED: "items.unlimited",
    AI_ASSISTANT: "ai.assistant",
    FAMILY_MANAGEMENT: "family.management",
    PLANNING_CALENDAR: "planning.calendar",
    LIFE_EVENTS: "life.events",
    CONTEXT_MEMORY: "context.memory",
    VAULT_BASIC: "vault.basic",
    VAULT_UNLIMITED: "vault.unlimited",
    WORKFLOWS: "workflows",
    SMART_SUGGESTIONS: "smart.suggestions",
    WEEKLY_PLANNING: "weekly.planning",
    FAMILY_ACTIVITIES: "family.activities",
    BRAIN_DUMP: "brain.dump",
    BOOK_FOR_ME: "ai.book_for_me",
    DRAFT_FOR_ME: "ai.draft_for_me",
    EXECUTE_WORKFLOWS: "ai.execute_workflows",
    PREDICTIVE_SUGGESTIONS: "ai.predictive",
    AI_PLANNING: "ai.planning",
    BETA: "features.beta",
    EXPERIMENTAL: "features.experimental",
  });

  const CAPABILITIES = Object.freeze({
    ADMIN_VIEW_USERS: "admin.view_users",
    ADMIN_MANAGE_USERS: "admin.manage_users",
    ADMIN_MANAGE_ROLES: "admin.manage_roles",
    ADMIN_MANAGE_PLANS: "admin.manage_plans",
    ADMIN_ANALYTICS: "admin.analytics",
    FOUNDER_BYPASS: "founder.bypass_restrictions",
    FOUNDER_BETA: "features.beta",
    FOUNDER_EXPERIMENTAL: "features.experimental",
  });

  const CATEGORY_FEATURE = Object.freeze({
    mot: FEATURES.CATEGORY_MOT,
    passport: FEATURES.CATEGORY_PASSPORT,
    licence: FEATURES.CATEGORY_LICENCE,
    subscriptions: FEATURES.CATEGORY_SUBSCRIPTIONS,
    bills: FEATURES.CATEGORY_BILLS,
  });

  const PLAN_FEATURES = Object.freeze({
    [PLANS.FREE]: [
      FEATURES.CATEGORY_MOT,
      FEATURES.CATEGORY_PASSPORT,
      FEATURES.CATEGORY_LICENCE,
      FEATURES.NOTIFICATIONS_BASIC,
      FEATURES.DASHBOARD_TODAY,
      FEATURES.VAULT_BASIC,
      FEATURES.BRAIN_DUMP,
      FEATURES.ITEMS_UNLIMITED,
      FEATURES.AI_ASSISTANT,
    ],
    [PLANS.FAMILY_PREMIUM]: [
      FEATURES.CATEGORY_MOT,
      FEATURES.CATEGORY_PASSPORT,
      FEATURES.CATEGORY_LICENCE,
      FEATURES.CATEGORY_SUBSCRIPTIONS,
      FEATURES.CATEGORY_BILLS,
      FEATURES.NOTIFICATIONS_BASIC,
      FEATURES.NOTIFICATIONS_PRIORITIES,
      FEATURES.DASHBOARD_TODAY,
      FEATURES.ITEMS_UNLIMITED,
      FEATURES.FAMILY_MANAGEMENT,
      FEATURES.PLANNING_CALENDAR,
      FEATURES.LIFE_EVENTS,
      FEATURES.CONTEXT_MEMORY,
      FEATURES.VAULT_UNLIMITED,
      FEATURES.WORKFLOWS,
      FEATURES.SMART_SUGGESTIONS,
      FEATURES.WEEKLY_PLANNING,
      FEATURES.FAMILY_ACTIVITIES,
    ],
    [PLANS.AI_CHIEF_OF_STAFF]: [
      FEATURES.CATEGORY_MOT,
      FEATURES.CATEGORY_PASSPORT,
      FEATURES.CATEGORY_LICENCE,
      FEATURES.CATEGORY_SUBSCRIPTIONS,
      FEATURES.CATEGORY_BILLS,
      FEATURES.NOTIFICATIONS_BASIC,
      FEATURES.NOTIFICATIONS_PRIORITIES,
      FEATURES.DASHBOARD_TODAY,
      FEATURES.ITEMS_UNLIMITED,
      FEATURES.AI_ASSISTANT,
      FEATURES.FAMILY_MANAGEMENT,
      FEATURES.PLANNING_CALENDAR,
      FEATURES.LIFE_EVENTS,
      FEATURES.CONTEXT_MEMORY,
      FEATURES.VAULT_UNLIMITED,
      FEATURES.WORKFLOWS,
      FEATURES.SMART_SUGGESTIONS,
      FEATURES.WEEKLY_PLANNING,
      FEATURES.FAMILY_ACTIVITIES,
      FEATURES.BOOK_FOR_ME,
      FEATURES.DRAFT_FOR_ME,
      FEATURES.EXECUTE_WORKFLOWS,
      FEATURES.PREDICTIVE_SUGGESTIONS,
      FEATURES.AI_PLANNING,
      FEATURES.BETA,
      FEATURES.EXPERIMENTAL,
    ],
  });

  const ROLE_CAPABILITIES = Object.freeze({
    [ROLES.USER]: [],
    [ROLES.ADMIN]: [
      CAPABILITIES.ADMIN_VIEW_USERS,
      CAPABILITIES.ADMIN_MANAGE_USERS,
      CAPABILITIES.ADMIN_MANAGE_ROLES,
      CAPABILITIES.ADMIN_MANAGE_PLANS,
      CAPABILITIES.ADMIN_ANALYTICS,
    ],
    [ROLES.FOUNDER]: [
      CAPABILITIES.ADMIN_VIEW_USERS,
      CAPABILITIES.ADMIN_MANAGE_USERS,
      CAPABILITIES.ADMIN_MANAGE_ROLES,
      CAPABILITIES.ADMIN_MANAGE_PLANS,
      CAPABILITIES.ADMIN_ANALYTICS,
      CAPABILITIES.FOUNDER_BYPASS,
      CAPABILITIES.FOUNDER_BETA,
      CAPABILITIES.FOUNDER_EXPERIMENTAL,
    ],
  });

  const PLAN_LABELS = Object.freeze({
    [PLANS.FREE]: "Free",
    [PLANS.FAMILY_PREMIUM]: "Family Premium",
    [PLANS.AI_CHIEF_OF_STAFF]: "AI Chief of Staff",
  });

  const PUBLIC_PLAN_LABELS = Object.freeze({
    [PLANS.FREE]: "Free",
    [PLANS.FAMILY_PREMIUM]: "Premium",
    [PLANS.AI_CHIEF_OF_STAFF]: "AI Chief of Staff",
  });

  const ROLE_LABELS = Object.freeze({
    [ROLES.USER]: "User",
    [ROLES.FOUNDER]: "Founder",
    [ROLES.ADMIN]: "Admin",
  });

  const PLAN_ITEM_LIMIT = Object.freeze({
    [PLANS.FREE]: 10,
    [PLANS.FAMILY_PREMIUM]: null,
    [PLANS.AI_CHIEF_OF_STAFF]: null,
  });

  const UPGRADE_HINT = Object.freeze({
    [FEATURES.CATEGORY_SUBSCRIPTIONS]: PLANS.FAMILY_PREMIUM,
    [FEATURES.CATEGORY_BILLS]: PLANS.FAMILY_PREMIUM,
    [FEATURES.NOTIFICATIONS_PRIORITIES]: PLANS.FAMILY_PREMIUM,
    [FEATURES.ITEMS_UNLIMITED]: PLANS.FAMILY_PREMIUM,
    [FEATURES.AI_ASSISTANT]: PLANS.AI_CHIEF_OF_STAFF,
    [FEATURES.FAMILY_MANAGEMENT]: PLANS.FAMILY_PREMIUM,
    [FEATURES.PLANNING_CALENDAR]: PLANS.FAMILY_PREMIUM,
    [FEATURES.LIFE_EVENTS]: PLANS.FAMILY_PREMIUM,
    [FEATURES.WORKFLOWS]: PLANS.FAMILY_PREMIUM,
    [FEATURES.VAULT_UNLIMITED]: PLANS.FAMILY_PREMIUM,
    [FEATURES.SMART_SUGGESTIONS]: PLANS.FAMILY_PREMIUM,
    [FEATURES.WEEKLY_PLANNING]: PLANS.FAMILY_PREMIUM,
    [FEATURES.FAMILY_ACTIVITIES]: PLANS.FAMILY_PREMIUM,
    [FEATURES.BOOK_FOR_ME]: PLANS.AI_CHIEF_OF_STAFF,
    [FEATURES.DRAFT_FOR_ME]: PLANS.AI_CHIEF_OF_STAFF,
    [FEATURES.EXECUTE_WORKFLOWS]: PLANS.AI_CHIEF_OF_STAFF,
    [FEATURES.PREDICTIVE_SUGGESTIONS]: PLANS.AI_CHIEF_OF_STAFF,
    [FEATURES.AI_PLANNING]: PLANS.AI_CHIEF_OF_STAFF,
    [FEATURES.BETA]: PLANS.AI_CHIEF_OF_STAFF,
    [FEATURES.EXPERIMENTAL]: PLANS.AI_CHIEF_OF_STAFF,
  });

  let context = {
    role: ROLES.USER,
    plan: PLANS.FREE,
    userId: null,
    email: null,
    fullName: null,
  };

  function normalizeRole(role) {
    return Object.values(ROLES).includes(role) ? role : ROLES.USER;
  }

  function normalizePlan(plan) {
    return Object.values(PLANS).includes(plan) ? plan : PLANS.FREE;
  }

  function bypassesRestrictions() {
    return context.role === ROLES.FOUNDER;
  }

  function planFeatures(plan) {
    return PLAN_FEATURES[normalizePlan(plan)] || PLAN_FEATURES[PLANS.FREE];
  }

  function roleCapabilities(role) {
    return ROLE_CAPABILITIES[normalizeRole(role)] || [];
  }

  function hasCapability(capability) {
    if (bypassesRestrictions()) return true;
    return roleCapabilities(context.role).includes(capability);
  }

  function canAccess(feature) {
    if (bypassesRestrictions()) return true;
    if (hasCapability(feature)) return true;
    return planFeatures(context.plan).includes(feature);
  }

  function canAccessCategory(category) {
    const feature = CATEGORY_FEATURE[category];
    return feature ? canAccess(feature) : false;
  }

  function canAccessBeta() {
    return canAccess(FEATURES.BETA);
  }

  function canAccessExperimental() {
    return canAccess(FEATURES.EXPERIMENTAL);
  }

  function isAdmin() {
    return context.role === ROLES.ADMIN || context.role === ROLES.FOUNDER;
  }

  function getItemLimit() {
    if (bypassesRestrictions() || canAccess(FEATURES.ITEMS_UNLIMITED)) return null;
    return PLAN_ITEM_LIMIT[context.plan] ?? PLAN_ITEM_LIMIT[PLANS.FREE];
  }

  function canAddItem(category, currentCount) {
    if (!canAccessCategory(category)) return false;
    const limit = getItemLimit();
    if (limit == null) return true;
    return currentCount < limit;
  }

  function getUpgradePlanForFeature(feature) {
    return UPGRADE_HINT[feature] || PLANS.FAMILY_PREMIUM;
  }

  function getPublicPlanLabel(plan) {
    return PUBLIC_PLAN_LABELS[normalizePlan(plan)] || "Free";
  }

  function getUpgradeMessage(feature) {
    const target = getUpgradePlanForFeature(feature);
    return `Upgrade to ${getPublicPlanLabel(target)} to unlock this feature.`;
  }

  function canUseWorkflows() {
    return canAccess(FEATURES.WORKFLOWS) || canAccess(FEATURES.LIFE_EVENTS);
  }

  function isInternalRole() {
    return context.role === ROLES.FOUNDER || context.role === ROLES.ADMIN;
  }

  function shouldShowRoleInUI() {
    return context.role === ROLES.ADMIN;
  }

  function setUserContext({ role, plan, userId, email, fullName } = {}) {
    context = {
      role: normalizeRole(role != null ? role : context.role),
      plan: normalizePlan(plan != null ? plan : context.plan),
      userId: userId !== undefined ? userId : context.userId,
      email: email !== undefined ? email : context.email,
      fullName: fullName !== undefined ? fullName : context.fullName,
    };
    return context;
  }

  function getUserContext() {
    return { ...context };
  }

  window.LifeAdminAccess = {
    ROLES,
    PLANS,
    FEATURES,
    CAPABILITIES,
    CATEGORY_FEATURE,
    PLAN_LABELS,
    PUBLIC_PLAN_LABELS,
    ROLE_LABELS,
    getPublicPlanLabel,
    canUseWorkflows,
    isInternalRole,
    shouldShowRoleInUI,
    setUserContext,
    getUserContext,
    bypassesRestrictions,
    canAccess,
    canAccessCategory,
    canAccessBeta,
    canAccessExperimental,
    hasCapability,
    isAdmin,
    getItemLimit,
    canAddItem,
    getUpgradeMessage,
    getUpgradePlanForFeature,
  };
})();
