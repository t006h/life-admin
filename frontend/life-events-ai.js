/**
 * Life Admin — placeholder AI hints for life event workflows
 */
(function () {
  const HINTS = Object.freeze({
    moving_house: [
      { text: "Council tax transfer", sub: "Notify old and new local authority" },
      { text: "Internet & broadband setup", sub: "Book install before move-in week" },
      { text: "School catchment checks", sub: "If moving with children" },
      { text: "Parking permits at new address", sub: "Council or private estate rules" },
      { text: "Deep clean / handover inventory", sub: "Photos for deposit disputes" },
      { text: "Update driving licence address", sub: "DVLA online — free" },
    ],
    new_job: [
      { text: "HMRC tax code check", sub: "First payslip surprises" },
      { text: "Cycle-to-work or season ticket loan", sub: "Often within first month" },
      { text: "Update LinkedIn & professional insurance", sub: "If client-facing role" },
      { text: "Childcare vouchers or benefits window", sub: "Enrolment deadlines" },
    ],
    holiday_planning: [
      { text: "Roaming / eSIM for mobile", sub: "Avoid bill shock abroad" },
      { text: "EHIC / GHIC health cover", sub: "Check still valid for destination" },
      { text: "Freeze milk / subscriptions delivery", sub: "Pause while away" },
      { text: "Share emergency contacts with pet sitter", sub: "Vet + neighbour" },
    ],
    starting_university: [
      { text: "TV licence for halls", sub: "May be included — check contract" },
      { text: "Contents insurance for laptop", sub: "Often separate from home policy" },
      { text: "Register to vote at term-time address", sub: "Or postal vote" },
      { text: "NHS dentist near campus", sub: "Can be hard to find — book early" },
    ],
    pregnancy: [
      { text: "Free prescriptions & dental", sub: "Mat exemption certificate" },
      { text: "Will / guardianship conversation", sub: "Uncomfortable but important" },
      { text: "Car seat research (i-Size)", sub: "Before third trimester fatigue" },
      { text: "Child benefit registration", sub: "After birth — not before" },
    ],
    starting_business: [
      { text: "Separate business expenses card", sub: "Simplifies bookkeeping" },
      { text: "ICO registration if storing emails", sub: "UK data protection" },
      { text: "Terms of service for website", sub: "Especially if selling online" },
      { text: "Key person insurance", sub: "If you have dependents" },
    ],
    passport_renewal: [
      { text: "Check passport validity", sub: "Must have 6+ months left on some trips" },
      { text: "Update insurance", sub: "Travel policies may need passport details" },
      { text: "Notify school", sub: "If children travel on your passport" },
      { text: "Register new passport with bank", sub: "ID verification for accounts" },
    ],
    buy_car: [
      { text: "Breakdown cover", sub: "Often forgotten until first long trip" },
      { text: "Update address on licence", sub: "DVLA when you move registration" },
      { text: "Parking permit at home", sub: "Council or estate rules" },
    ],
    school_trip: [
      { text: "Notify school", sub: "Allergies or medical info updates" },
      { text: "Emergency contact details", sub: "Double-check form" },
    ],
    dentist_appointment: [
      { text: "Check NHS vs private cover", sub: "Costs and waiting times" },
    ],
  });

  function normalize(str) {
    return String(str || "").toLowerCase();
  }

  function isCoveredByItems(hint, items) {
    const t = normalize(hint.text);
    return (items || []).some((i) => {
      if (i.done) return false;
      const title = normalize(i.title);
      return title.includes(t.split(" ")[0]) || t.includes(title.slice(0, 8));
    });
  }

  function getForgettingHints(workflowType, items) {
    const pool = HINTS[workflowType] || [
      { text: "Review your vault for missing documents", sub: "Keep everything in one place" },
      { text: "Add key dates to Planning calendar", sub: "Time-block the heavy tasks" },
    ];
    return pool
      .filter((h) => !isCoveredByItems(h, items))
      .slice(0, 5);
  }

  window.LifeAdminLifeEventsAI = { getForgettingHints, HINTS };
})();
