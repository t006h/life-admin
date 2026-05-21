/**
 * Placeholder AI — break tasks into steps (no API yet).
 */
(function () {
  const TEMPLATES = [
    {
      match: (t) => /passport/i.test(t),
      steps: [
        "Check expiry date",
        "Gather documents",
        "Complete application",
        "Pay fee",
        "Submit application",
      ],
    },
    {
      match: (t) => /mot|vehicle|car/i.test(t),
      steps: [
        "Book garage appointment",
        "Run pre-check lights & tyres",
        "Take vehicle to test centre",
        "Pay MOT fee",
        "File certificate at home",
      ],
    },
    {
      match: (t) => /licen[cs]e|driving/i.test(t),
      steps: [
        "Check renewal date online",
        "Gather photo ID",
        "Complete DVLA form",
        "Pay renewal fee",
        "Destroy old licence if required",
      ],
    },
    {
      match: (t) => /school|form/i.test(t),
      steps: [
        "Read form instructions",
        "Collect required info",
        "Complete each section",
        "Review with family member",
        "Submit before deadline",
      ],
    },
    {
      match: (t) => /tax|council|bill/i.test(t),
      steps: [
        "Confirm amount due",
        "Check payment method",
        "Schedule payment date",
        "Pay and save receipt",
        "Log in Life Admin",
      ],
    },
  ];

  const DEFAULT_STEPS = [
    "Clarify what done looks like",
    "List materials or info needed",
    "Do the main work",
    "Review and fix gaps",
    "Mark complete",
  ];

  function breakDownTask(title, description) {
    const combined = `${title || ""} ${description || ""}`.trim();
    for (const tpl of TEMPLATES) {
      if (tpl.match(combined)) {
        return tpl.steps.map((label, i) => ({
          id: `step-${i + 1}`,
          label,
          done: false,
        }));
      }
    }
    return DEFAULT_STEPS.map((label, i) => ({
      id: `step-${i + 1}`,
      label,
      done: false,
    }));
  }

  window.LifeAdminTaskAI = { breakDownTask };
})();
