export interface AIRecommendation {
  value: string;
  confidence: number;
  reasoning: string;
  improvements: string[];
}

export interface AIRisk {
  id: string;
  severity: "High" | "Medium" | "Low";
  message: string;
  fix: string;
  fieldId: string; // The field to highlight
}

export interface GuidelineCompliance {
  id: string;
  guideline: "CONSORT" | "SPIRIT" | "ICMR";
  item: string;
  status: "Fulfilled" | "Missing" | "Partial";
  message: string;
}

export interface ProtocolIntelligence {
  qualityScore: number; // 0 - 100
  completeness: number; // 0 - 100
  risks: AIRisk[];
  compliance: GuidelineCompliance[];
  lastCalculated: string;
}

export interface ProtocolState {
  id?: number;
  title?: string;
  researchQuestion: string;
  pico: { population: string; intervention: string; comparator: string; outcome: string };
  hypothesis: { 
    primary: string; 
    nullHypothesis: string; 
    alternative: string; 
    primaryObjective: string; 
    secondaryObjectives: string[];
    isAuto: boolean;
    aiMetadata?: AIRecommendation;
  };
  studyType: { 
    recommended: string; 
    isAuto: boolean;
    aiMetadata?: AIRecommendation; 
  };
  sampleSizeParams: { alpha: number; power: number; effectSize: number; ratio: number };
  sampleSizeResult: { total: number; perArm: number };
  statisticalPlan: { 
    primaryEndpoint: string; 
    recommendedTest: string; 
    missingData: string; 
    regression: string; 
    subgroups: string;
    isAuto: boolean;
    aiMetadata?: AIRecommendation;
  };
  criteria: { inclusion: { id: string; text: string }[]; exclusion: { id: string; text: string }[] };
  confounders: { id: string; name: string; risk: "High" | "Medium" | "Low"; mitigation: string }[];
  ayurveda: {
    formulation: string;
    dosage: string;
    anupana: string;
    prakriti: string;
    duration: string;
    safety: string;
    standardization: string;
  };
  timeline: { id: string; label: string; duration: string; color: string }[];
  ethics: { id: string; label: string; checked: boolean }[];
  handoffData: any | null;
  
  // New Intelligence Block
  intelligence: ProtocolIntelligence;
  versionId?: string;
  timestamp?: string;
}

// --- DETERMINISTIC AI ENGINE (Replaceable with LLM API) ---

export function generateHypotheses(pico: ProtocolState['pico']): ProtocolState['hypothesis'] {
  const p = pico.population || "[Population]";
  const i = pico.intervention || "[Intervention]";
  const c = pico.comparator || "[Comparator]";
  const o = pico.outcome || "[Outcome]";
  
  const hasComparator = !!pico.comparator;
  const isComplete = pico.population && pico.intervention && pico.outcome;

  let conf = isComplete ? (hasComparator ? 92 : 85) : 40;
  
  const primary = hasComparator 
    ? `Administration of ${i} will result in a statistically significant improvement in ${o} compared to ${c} in ${p}.`
    : `Administration of ${i} will result in a statistically significant improvement in ${o} in ${p}.`;

  const reasoning = hasComparator 
    ? "The hypothesis is structured comparatively, allowing for causality testing." 
    : "Without a comparator, the hypothesis assumes pre-post changes rather than strict causality.";

  const improvements = [];
  if (!pico.population) improvements.push("Define the target population demographics.");
  if (!pico.intervention) improvements.push("Specify the exact intervention.");
  if (!pico.outcome) improvements.push("Define a measurable primary endpoint.");
  if (!pico.comparator) improvements.push("Consider adding a comparator/placebo to increase methodological rigor.");

  return {
    primary,
    nullHypothesis: hasComparator
      ? `There is no significant difference in ${o} between ${i} and ${c} in ${p}.`
      : `There is no significant change in ${o} following ${i} in ${p}.`,
    alternative: hasComparator
      ? `There is a significant difference in ${o} between ${i} and ${c} in ${p}.`
      : `There is a significant change in ${o} following ${i} in ${p}.`,
    primaryObjective: `To evaluate the efficacy of ${i} on ${o} in ${p}.`,
    secondaryObjectives: [
      `To assess the safety and tolerability of ${i} in ${p}.`,
      `To evaluate changes in quality of life metrics.`
    ],
    isAuto: true,
    aiMetadata: { value: primary, confidence: conf, reasoning, improvements }
  };
}

export function recommendStudyType(pico: ProtocolState['pico']): ProtocolState['studyType'] {
  let rec = "Pending PICO Definition";
  let conf = 10;
  let reason = "Incomplete parameters to determine study architecture.";
  let improvements = ["Complete all PICO fields to receive a structural recommendation."];

  if (pico.intervention && pico.comparator) {
    rec = "Randomized Controlled Trial (RCT)";
    conf = 95;
    reason = "Presence of a defined intervention and comparator group strongly indicates an RCT to establish causality and minimize bias.";
    improvements = ["Ensure randomization strategy is documented.", "Define blinding protocols (single/double)."];
  } else if (pico.intervention && !pico.comparator) {
    rec = "Single-Arm Trial / Phase II Pilot";
    conf = 80;
    reason = "An intervention without a comparator suggests evaluating initial feasibility, safety, or early efficacy.";
    improvements = ["Add a comparator group to upgrade to an RCT.", "Explicitly state feasibility endpoints."];
  } else if (!pico.intervention && pico.outcome) {
    rec = "Prospective Cohort Study";
    conf = 85;
    reason = "Measuring outcomes without an assigned intervention indicates an observational trajectory.";
    improvements = ["Define strict follow-up timelines.", "Document known confounding variables."];
  }

  return {
    recommended: rec,
    isAuto: true,
    aiMetadata: { value: rec, confidence: conf, reasoning: reason, improvements }
  };
}

export function recommendStatisticalTest(studyType: string, outcome: string): ProtocolState['statisticalPlan']['aiMetadata'] {
  let test = "Pending";
  let reason = "";
  
  if (studyType.includes("RCT")) {
    test = "ANCOVA (Baseline Adjusted)";
    reason = "ANCOVA is highly recommended for RCTs to adjust for baseline covariates, increasing statistical power compared to standard t-tests.";
  } else if (studyType.includes("Cohort")) {
    test = "Cox Proportional Hazards";
    reason = "Ideal for observational cohorts tracking time-to-event outcomes.";
  } else {
    test = "Paired T-Test / Wilcoxon";
    reason = "Appropriate for pre-post longitudinal comparisons within a single arm.";
  }

  return {
    value: test,
    confidence: 90,
    reasoning: reason,
    improvements: ["Ensure data normality assumptions are checked before applying parametric tests."]
  };
}

// --- PROTOCOL INTELLIGENCE (Risks, Score, Compliance) ---

export function analyzeProtocol(state: ProtocolState): ProtocolIntelligence {
  const risks: AIRisk[] = [];
  const compliance: GuidelineCompliance[] = [];
  let score = 100;
  let completedFields = 0;
  const totalFields = 12; // Approximation of major sections

  // 1. Research Question Check
  if (state.researchQuestion.length > 0) {
    completedFields++;
    compliance.push({ id: "g1", guideline: "SPIRIT", item: "Item 2b: Background & Rationale", status: "Fulfilled", message: "Research question is defined." });
  } else {
    compliance.push({ id: "g1", guideline: "SPIRIT", item: "Item 2b: Background & Rationale", status: "Missing", message: "Missing background rationale." });
    score -= 10;
  }

  // 2. PICO & Study Type Checks
  let isPicoComplete = true;
  if (!state.pico.population || !state.pico.intervention || !state.pico.outcome) {
    isPicoComplete = false;
    risks.push({ id: "r1", severity: "High", message: "Core PICO components are missing.", fix: "Complete Population, Intervention, and Outcome.", fieldId: "pico" });
    score -= 20;
  } else {
    completedFields += 3;
  }

  if (state.studyType.recommended.includes("RCT") && !state.pico.comparator) {
    risks.push({ id: "r2", severity: "High", message: "RCT architecture requires a defined comparator.", fix: "Add a comparator in the PICO builder.", fieldId: "pico" });
    score -= 15;
  }

  // 3. Sample Size Risk
  if (state.sampleSizeResult.total > 0) {
    completedFields++;
    if (state.sampleSizeResult.total < 30) {
      risks.push({ id: "r3", severity: "Medium", message: "Very small sample size (<30) risks severe underpowering (Type II error).", fix: "Increase Target Power or accept a larger Effect Size.", fieldId: "samplesize" });
      score -= 10;
    }
  } else {
    score -= 10;
  }

  // 4. Criteria & Confounders
  if (state.criteria.inclusion.length > 0 && state.criteria.exclusion.length > 0) {
    completedFields += 2;
    compliance.push({ id: "g2", guideline: "CONSORT", item: "Item 4a: Eligibility Criteria", status: "Fulfilled", message: "Inclusion/Exclusion criteria defined." });
  } else {
    compliance.push({ id: "g2", guideline: "CONSORT", item: "Item 4a: Eligibility Criteria", status: "Missing", message: "Criteria are incomplete." });
    score -= 5;
  }

  if (state.confounders.length === 0) {
    risks.push({ id: "r4", severity: "Medium", message: "No confounding variables identified.", fix: "List potential confounders and mitigation strategies.", fieldId: "confounders" });
    score -= 5;
  } else {
    completedFields++;
  }

  // 5. Ayurveda Specifics (ICMR Guidelines)
  let ayushFields = 0;
  if (state.ayurveda.formulation) ayushFields++;
  if (state.ayurveda.dosage) ayushFields++;
  if (state.ayurveda.anupana) ayushFields++;
  
  if (ayushFields > 0) {
    completedFields++;
    if (ayushFields < 3) {
      compliance.push({ id: "g3", guideline: "ICMR", item: "Traditional Medicine Trials", status: "Partial", message: "Missing formulation, dosage, or anupana details." });
      score -= 5;
    } else {
      compliance.push({ id: "g3", guideline: "ICMR", item: "Traditional Medicine Trials", status: "Fulfilled", message: "Core AYUSH parameters defined." });
    }
  }

  // 6. Statistics
  if (state.statisticalPlan.recommendedTest) {
    completedFields++;
    compliance.push({ id: "g4", guideline: "SPIRIT", item: "Item 20a: Statistical Methods", status: "Fulfilled", message: "Analysis plan initialized." });
  } else {
    compliance.push({ id: "g4", guideline: "SPIRIT", item: "Item 20a: Statistical Methods", status: "Missing", message: "Missing statistical plan." });
    score -= 5;
  }
  
  // 7. Ethics
  const ethicsCompleted = state.ethics.filter(e => e.checked).length;
  if (ethicsCompleted > 0) completedFields++;
  if (ethicsCompleted < state.ethics.length) {
    risks.push({ id: "r5", severity: "Low", message: "Ethics compliance checklist is incomplete.", fix: "Review and check all ethical requirements.", fieldId: "ethics" });
    score -= 5;
  }

  const completeness = Math.round((completedFields / totalFields) * 100);
  
  return {
    qualityScore: Math.max(0, score),
    completeness: Math.min(100, completeness),
    risks,
    compliance,
    lastCalculated: new Date().toISOString()
  };
}
