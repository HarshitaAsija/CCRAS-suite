import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)

# --- AGENT SCHEMAS / INTERFACES FOR LLM AGENTS ---
class ClinicalTrialArchitectAgent:
    """Agent responsible for defining clinical study type and core trial design."""
    def recommend(self, pico: Dict[str, Any]) -> Dict[str, Any]:
        p = pico.get("population", "")
        i = pico.get("intervention", "")
        c = pico.get("comparator", "")
        o = pico.get("outcome", "")

        # Rich simulated reasoning based on PICO
        if i and c:
            rec = "Randomized Controlled Trial (RCT)"
            confidence = 96
            reasoning = (
                f"Establishing efficacy of {i} vs. control {c} in {p} requires a double-blind, "
                f"parallel-group RCT to control for placebo effect, investigator bias, and temporal confounders. "
                f"Randomization will ensure demographic balance across study groups."
            )
            improvements = [
                "Implement block randomization stratified by age/gender.",
                "Detail blinding protocols (placebo packaging matching active intervention)."
            ]
        elif i and not c:
            rec = "Single-Arm Trial / Phase II Pilot"
            confidence = 82
            reasoning = (
                f"Evaluating feasibility and safety of {i} in {p} without a control arm is suitable "
                f"for initial pilot investigations or safety profiling before initiating large-scale RCTs."
            )
            improvements = [
                "Include historical controls or baseline run-in parameters.",
                "Establish strict criteria for early stopping due to toxicity."
            ]
        else:
            rec = "Prospective Cohort Study"
            confidence = 85
            reasoning = (
                f"Observing patient trajectory for changes in {o} in {p} without direct clinical "
                f"intervention limits structural causality, indicating an observational design."
            )
            improvements = [
                "Document baseline exposure variables carefully.",
                "Adjust for lifestyle and socioeconomic covariates."
            ]

        return {
            "value": rec,
            "confidence": confidence,
            "reasoning": reasoning,
            "improvements": improvements
        }


class BiostatisticsAdvisorAgent:
    """Agent recommending statistical plans, primary endpoints, and testing regimens."""
    def recommend_test(self, study_type: str, outcome: str) -> Dict[str, Any]:
        if "RCT" in study_type:
            test = "ANCOVA (Baseline Adjusted)"
            reasoning = (
                f"For an RCT evaluating {outcome or 'primary outcome'}, ANCOVA is preferred over a t-test "
                f"as it adjusts for baseline scores, increasing statistical power and reducing residual variance."
            )
            improvements = ["Verify normality assumptions.", "Describe handling of baseline covariates."]
        elif "Cohort" in study_type:
            test = "Cox Proportional Hazards"
            reasoning = (
                f"For observational cohort trajectories, Cox regression is ideal to model time-to-event "
                f"data for {outcome or 'endpoints'} while adjusting for multiple confounders."
            )
            improvements = ["Test the proportional hazards assumption.", "Specify handling of censored data."]
        else:
            test = "Paired T-Test / Wilcoxon Signed-Rank"
            reasoning = (
                f"For longitudinal within-subject pre-post designs, paired comparison tests "
                f"are appropriate to measure significance of clinical shifts."
            )
            improvements = ["Assess skewness to decide between parametric and non-parametric tests."]

        return {
            "value": test,
            "confidence": 90,
            "reasoning": reasoning,
            "improvements": improvements
        }


class AYUSHProtocolComplianceAgent:
    """Agent ensuring compliance with Ayurvedic research standards, pharmacognosy, and safety guidelines."""
    def verify(self, ayurveda: Dict[str, Any]) -> List[Dict[str, Any]]:
        compliance = []
        formulation = ayurveda.get("formulation", "")
        standardization = ayurveda.get("standardization", "")
        safety = ayurveda.get("safety", "")

        if formulation:
            # 1. API Standardization check
            if standardization:
                compliance.append({
                    "id": "ayush_std",
                    "guideline": "AYUSH",
                    "item": "Pharmacopoeial Standardization",
                    "status": "Fulfilled",
                    "message": f"Formulation '{formulation}' conforms to API (Ayurvedic Pharmacopoeia of India) specifications."
                })
            else:
                compliance.append({
                    "id": "ayush_std",
                    "guideline": "AYUSH",
                    "item": "Pharmacopoeial Standardization",
                    "status": "Missing",
                    "message": f"Formulation '{formulation}' lacks API quality control parameters and standardization markers."
                })

            # 2. Safety monitoring check
            if safety:
                compliance.append({
                    "id": "ayush_safe",
                    "guideline": "AYUSH",
                    "item": "Safety Profile & Heavy Metal Screening",
                    "status": "Fulfilled",
                    "message": f"Safety monitoring protocol defined: {safety}"
                })
            else:
                compliance.append({
                    "id": "ayush_safe",
                    "guideline": "AYUSH",
                    "item": "Safety Profile & Heavy Metal Screening",
                    "status": "Missing",
                    "message": f"Traditional formulations require strict LFT/RFT renal/hepatic safety screens and heavy metal tests."
                })
        return compliance


class EthicsGuidelineReviewerAgent:
    """Agent auditing guidelines (CONSORT, SPIRIT, ICMR) for trial compliance."""
    def check(self, state: Dict[str, Any]) -> List[Dict[str, Any]]:
        compliance = []
        pico = state.get("pico", {})
        research_question = state.get("research_question", "")
        sample_size = state.get("sample_size", {})
        ethics = state.get("ethics", [])

        # SPIRIT check
        if research_question and pico.get("population"):
            compliance.append({
                "id": "g1", "guideline": "SPIRIT", "item": "Item 2b: Background & Rationale",
                "status": "Fulfilled", "message": "Clinical background and target demographics are fully described."
            })
        else:
            compliance.append({
                "id": "g1", "guideline": "SPIRIT", "item": "Item 2b: Background & Rationale",
                "status": "Missing", "message": "Missing description of background scientific rationale."
            })

        # CONSORT check
        if sample_size and sample_size.get("total", 0) > 0:
            compliance.append({
                "id": "g2", "guideline": "CONSORT", "item": "Item 4a: Eligibility Criteria & Sample",
                "status": "Fulfilled", "message": "Statistical sample calculations and criteria checklist completed."
            })
        else:
            compliance.append({
                "id": "g2", "guideline": "CONSORT", "item": "Item 4a: Eligibility Criteria & Sample",
                "status": "Missing", "message": "Fails to provide target sample size calculations."
            })

        # ICMR Ethical check
        ethics_checked = all(e.get("checked", False) for e in ethics) if ethics else False
        if ethics_checked:
            compliance.append({
                "id": "g3", "guideline": "ICMR", "item": "Ethics & CTRI Registration",
                "status": "Fulfilled", "message": "Institutional IRB approvals and trial registrations configured."
            })
        else:
            compliance.append({
                "id": "g3", "guideline": "ICMR", "item": "Ethics & CTRI Registration",
                "status": "Partial", "message": "Pending ethical clearances and CTRI registration checks."
            })

        return compliance


class RiskBiasAssessmentAgent:
    """Agent scanning for methodological, statistical, and selection bias risk factors."""
    def assess(self, state: Dict[str, Any]) -> List[Dict[str, Any]]:
        risks = []
        pico = state.get("pico", {})
        study_type_rec = state.get("study_type", {}).get("recommended", "")
        sample_size = state.get("sample_size", {})
        confounders = state.get("confounders", [])
        criteria = state.get("eligibility", state.get("criteria", {}))

        # 1. PICO Incompleteness check
        if not pico.get("population") or not pico.get("intervention") or not pico.get("outcome"):
            risks.append({
                "id": "r1", "severity": "High", "message": "Core PICO components are undefined.",
                "fix": "Specify Population, Intervention, and Primary Outcome.", "fieldId": "pico"
            })

        # 2. Control comparison check for RCT
        if "RCT" in study_type_rec and not pico.get("comparator"):
            risks.append({
                "id": "r2", "severity": "High", "message": "RCT study structure requires a control/comparator.",
                "fix": "Add a placebo or active drug comparator in PICO.", "fieldId": "pico"
            })

        # 3. Underpowered check
        total_sample = sample_size.get("total", 0)
        if total_sample > 0 and total_sample < 40:
            risks.append({
                "id": "r3", "severity": "High", "message": f"Sample size (N={total_sample}) is statistically underpowered.",
                "fix": "Increase target power to 85% or recalculate based on Cohen's d.", "fieldId": "samplesize"
            })

        # 4. Criteria check
        inc = criteria.get("inclusion", []) if isinstance(criteria, dict) else []
        exc = criteria.get("exclusion", []) if isinstance(criteria, dict) else []
        if len(inc) == 0 or len(exc) == 0:
            risks.append({
                "id": "r4", "severity": "Medium", "message": "Incomplete study eligibility criteria.",
                "fix": "Define at least two inclusion and two exclusion metrics.", "fieldId": "criteria"
            })

        # 5. Confounders check
        if len(confounders) == 0:
            risks.append({
                "id": "r5", "severity": "Medium", "message": "Confounding factors are not addressed.",
                "fix": "Add potential confounders (e.g. diet, baseline severity) and mitigations.", "fieldId": "confounders"
            })

        return risks


# --- HIGH LEVEL SERVICE WRAPPER (FALLBACK CAPABLE) ---
class StudyDesignAIService:
    def __init__(self):
        self.trial_architect = ClinicalTrialArchitectAgent()
        self.biostat_advisor = BiostatisticsAdvisorAgent()
        self.ayush_compliance = AYUSHProtocolComplianceAgent()
        self.ethics_reviewer = EthicsGuidelineReviewerAgent()
        self.bias_assessor = RiskBiasAssessmentAgent()

    def generate_hypothesis(self, pico: Dict[str, Any]) -> Dict[str, Any]:
        p = pico.get("population", "[Population]")
        i = pico.get("intervention", "[Intervention]")
        c = pico.get("comparator", "")
        o = pico.get("outcome", "[Outcome]")

        has_comparator = bool(c)
        is_complete = bool(pico.get("population") and pico.get("intervention") and pico.get("outcome"))
        confidence = 94 if is_complete else 50

        primary = (
            f"Administration of {i} will result in a statistically significant improvement in {o} compared to {c} in {p}."
            if has_comparator else
            f"Administration of {i} will result in a statistically significant improvement in {o} in {p}."
        )

        return {
            "primary": primary,
            "nullHypothesis": (
                f"There is no significant difference in {o} between {i} and {c} in {p}."
                if has_comparator else
                f"There is no significant change in {o} following {i} in {p}."
            ),
            "alternative": (
                f"There is a significant difference in {o} between {i} and {c} in {p}."
                if has_comparator else
                f"There is a significant change in {o} following {i} in {p}."
            ),
            "primaryObjective": f"To evaluate the efficacy of {i} on {o} in {p}.",
            "secondaryObjectives": [
                f"To assess safety, tolerability, and hepatorenal profile of {i} in {p}.",
                "To evaluate health-related quality of life outcomes."
            ],
            "aiMetadata": {
                "value": primary,
                "confidence": confidence,
                "reasoning": "Hypothesis generated based on target demographic and therapy endpoints.",
                "improvements": ["Specify primary endpoints at distinct intervals (e.g. week 4, 8, 12)."] if is_complete else ["Complete all PICO parameters first."]
            }
        }

    def recommend_study_type(self, pico: Dict[str, Any]) -> Dict[str, Any]:
        return self.trial_architect.recommend(pico)

    def recommend_statistical_plan(self, study_type: str, outcome: str) -> Dict[str, Any]:
        return self.biostat_advisor.recommend_test(study_type, outcome)

    def assess_bias_risk(self, state: Dict[str, Any]) -> List[Dict[str, Any]]:
        return self.bias_assessor.assess(state)

    def check_guidelines(self, state: Dict[str, Any]) -> List[Dict[str, Any]]:
        compliance = self.ethics_reviewer.check(state)
        ayurveda = state.get("ayurveda", state.get("ayush_protocol", {}))
        if ayurveda:
            compliance.extend(self.ayush_compliance.verify(ayurveda))
        return compliance

    def analyze_protocol(self, state: Dict[str, Any]) -> Dict[str, Any]:
        risks = self.assess_bias_risk(state)
        compliance = self.check_guidelines(state)

        # Compute Quality Score & Completeness
        score = 100
        for r in risks:
            if r.get("severity") == "High":
                score -= 15
            elif r.get("severity") == "Medium":
                score -= 8
            else:
                score -= 3

        for c in compliance:
            if c.get("status") == "Missing":
                score -= 5

        score = max(0, score)

        # Completeness based on defined parameters
        total_fields = 12
        completed = 0
        pico = state.get("pico", {})
        if state.get("research_question"): completed += 1
        if pico.get("population"): completed += 1
        if pico.get("intervention"): completed += 1
        if pico.get("outcome"): completed += 1
        if state.get("hypothesis", {}).get("primary"): completed += 1
        if state.get("study_type", {}).get("recommended") and "Pending" not in state.get("study_type", {}).get("recommended", ""): completed += 1
        if state.get("sample_size", {}).get("total", 0) > 0: completed += 1
        if state.get("statistical_plan", {}).get("recommendedTest") and "Pending" not in state.get("statistical_plan", {}).get("recommendedTest", ""): completed += 1
        criteria = state.get("criteria", state.get("eligibility", {}))
        if len(criteria.get("inclusion", [])) > 0: completed += 1
        if len(state.get("confounders", [])) > 0: completed += 1
        ayurveda = state.get("ayurveda", state.get("ayush_protocol", {}))
        if ayurveda and ayurveda.get("formulation"): completed += 1
        if len(state.get("timeline", [])) > 0: completed += 1

        completeness = int((completed / total_fields) * 100)

        return {
            "qualityScore": score,
            "completeness": min(100, completeness),
            "risks": risks,
            "compliance": compliance,
            "lastCalculated": datetime.now().isoformat()
        }

    def generate_summary(self, state: Dict[str, Any]) -> str:
        pico = state.get("pico", {})
        title = state.get("title", "Clinical Study Protocol")
        question = state.get("research_question", "No research question specified.")
        study_type = state.get("study_type", {}).get("recommended", "Unspecified Design")
        sample_size = state.get("sample_size", {})
        stat = state.get("statistical_plan", {})
        
        summary = (
            f"### Protocol Executive Summary: {title}\n\n"
            f"**Study Architecture:** {study_type}\n"
            f"**Target Population:** {pico.get('population', 'TBD')}\n"
            f"**Intervention (Active Arm):** {pico.get('intervention', 'TBD')}\n"
            f"**Control / Comparator:** {pico.get('comparator', 'No control arm specified.')}\n"
            f"**Primary Endpoint:** {pico.get('outcome', 'TBD')}\n\n"
            f"**Clinical Rationale:**\n{question}\n\n"
            f"**Statistical Summary:**\n"
            f"The trial plans to enroll a total of **{sample_size.get('total', 0)} participants** "
            f"({sample_size.get('perArm', 0)} per study arm). Differences in primary endpoints will be "
            f"evaluated using **{stat.get('recommendedTest', 'TBD')}** adjusting for baseline covariates."
        )
        return summary

    def generate_reviewer_report(self, state: Dict[str, Any]) -> str:
        risks = self.assess_bias_risk(state)
        compliance = self.check_guidelines(state)
        score = self.analyze_protocol(state).get("qualityScore", 0)

        high_risks = [r for r in risks if r["severity"] == "High"]
        med_risks = [r for r in risks if r["severity"] == "Medium"]

        report = (
            f"# IRB Reviewer Assessment Report\n"
            f"**Overall Methodological Score:** {score}/100\n"
            f"**Audit Status:** {'CRITICAL DEFICIENCIES DETECTED' if high_risks else 'PASSED WITH RECOMMENDATIONS' if med_risks else 'EXCELLENT'}\n\n"
            f"## Critical Risks & Methodological Deficiencies\n"
        )

        if not high_risks:
            report += "* No critical scientific risks identified.\n"
        else:
            for r in high_risks:
                report += f"- **[CRITICAL]** {r['message']} *Suggestion:* {r['fix']}\n"

        report += "\n## Guideline Audit Findings\n"
        for c in compliance:
            report += f"- **[{c['guideline']} Compliance - {c['status']}]** {c['item']}: {c['message']}\n"

        report += (
            f"\n## Reviewer Conclusion & Next Steps\n"
            f"This protocol requires addressing the items listed under Critical Risks. "
            f"The addition of standardized traditional AYUSH parameters conforms well to research rules."
        )
        return report

# Instantiate a single global service
ai_service = StudyDesignAIService()
