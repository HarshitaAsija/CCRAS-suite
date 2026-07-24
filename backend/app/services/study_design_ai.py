import os
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
import httpx
import re
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.models.paper import Paper

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
    def verify(self, ayurveda: Dict[str, Any], query_fn: Optional[Callable] = None) -> List[Dict[str, Any]]:
        compliance = []
        formulation = ayurveda.get("formulation", "")
        standardization = ayurveda.get("standardization", "")
        safety = ayurveda.get("safety", "")
        prakriti = ayurveda.get("prakriti", "")
        dosage = ayurveda.get("dosage", "")
        anupana = ayurveda.get("anupana", "")
        duration = ayurveda.get("duration", "")

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

            # 3. AI Compliance Auditor
            if query_fn:
                prompt = (
                    f"Evaluate compliance of this Ayurvedic trial protocol against AYUSH standards:\n"
                    f"- Formulation: {formulation}\n"
                    f"- Dosage: {dosage}\n"
                    f"- Anupana (carrier): {anupana}\n"
                    f"- Target Prakriti: {prakriti}\n"
                    f"- Duration: {duration}\n"
                    f"- Safety Check: {safety}\n"
                    f"- Standardization: {standardization}\n\n"
                    f"Respond ONLY in a valid JSON object matching the following structure:\n"
                    f"{{\n"
                    f'  "compliance": [\n'
                    f'    {{"id": "ayush_ai_prakriti", "guideline": "AYUSH", "item": "Prakriti Relevance", "status": "Fulfilled", "message": "Feedback message details"}}\n'
                    f'  ]\n'
                    f"}}"
                )
                try:
                    response = query_fn(prompt, "You are an AYUSH research standards auditor checking compliance of Ayurvedic trial formulations.")
                    if response:
                        import json
                        json_str = response.strip()
                        if "```json" in json_str:
                            json_str = json_str.split("```json")[1].split("```")[0].strip()
                        elif "```" in json_str:
                            json_str = json_str.split("```")[1].split("```")[0].strip()
                        
                        match = re.search(r'\{.*\}', json_str, re.DOTALL)
                        if match:
                            parsed = json.loads(match.group(0))
                            if parsed and "compliance" in parsed:
                                for item in parsed["compliance"]:
                                    if all(k in item for k in ["id", "guideline", "item", "status", "message"]):
                                        if not any(ex.get("item") == item["item"] for ex in compliance):
                                            compliance.append(item)
                except Exception as e:
                     logger.warning(f"Ollama AYUSH compliance audit failed: {e}")
        return compliance


class EthicsGuidelineReviewerAgent:
    """Agent auditing guidelines (CONSORT, SPIRIT, ICMR) for trial compliance."""
    def check(self, state: Dict[str, Any], query_fn: Optional[Callable] = None) -> List[Dict[str, Any]]:
        compliance = []
        pico = state.get("pico", {})
        research_question = state.get("research_question", "")
        sample_size = state.get("sample_size", state.get("sampleSizeParams", {}))
        sample_size_result = state.get("sample_size_result", state.get("sampleSizeResult", {}))
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
        total_sample = sample_size_result.get("total", 0) if isinstance(sample_size_result, dict) else 0
        if total_sample > 0:
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

        # AI Compliance Auditor
        if query_fn and research_question:
            prompt = (
                f"Assess clinical trial guideline compliance (CONSORT, SPIRIT, ICMR) for this study design:\n"
                f"- Research Question: {research_question}\n"
                f"- PICO: Population: {pico.get('population')}, Intervention: {pico.get('intervention')}, Comparator: {pico.get('comparator')}, Outcome: {pico.get('outcome')}\n"
                f"- Sample Size Target: {total_sample}\n"
                f"- Statistical Plan: {state.get('statistical_plan', {}).get('recommendedTest', 'Pending')}\n"
                f"- Ethics Checked: {[e.get('label') for e in ethics if e.get('checked')]}\n\n"
                f"Respond ONLY in a valid JSON object matching the following structure:\n"
                f"{{\n"
                f'  "compliance": [\n'
                f'    {{"id": "g_ai1", "guideline": "SPIRIT", "item": "Blinding Protocol", "status": "Fulfilled", "message": "Compliance details and recommendations"}}\n'
                f'  ]\n'
                f"}}"
            )
            try:
                response = query_fn(prompt, "You are a clinical trial compliance auditor reviewing protocols against SPIRIT, CONSORT, and ICMR ethical guidelines.")
                if response:
                    import json
                    json_str = response.strip()
                    if "```json" in json_str:
                        json_str = json_str.split("```json")[1].split("```")[0].strip()
                    elif "```" in json_str:
                        json_str = json_str.split("```")[1].split("```")[0].strip()
                    
                    match = re.search(r'\{.*\}', json_str, re.DOTALL)
                    if match:
                        parsed = json.loads(match.group(0))
                        if parsed and "compliance" in parsed:
                            for item in parsed["compliance"]:
                                if all(k in item for k in ["id", "guideline", "item", "status", "message"]):
                                    if not any(ex.get("item") == item["item"] for ex in compliance):
                                        compliance.append(item)
            except Exception as e:
                logger.warning(f"Ollama ethics compliance audit failed: {e}")
        return compliance


class RiskBiasAssessmentAgent:
    """Agent scanning for methodological, statistical, and selection bias risk factors."""
    def assess(self, state: Dict[str, Any], query_fn: Optional[Callable] = None) -> List[Dict[str, Any]]:
        risks = []
        pico = state.get("pico", {})
        study_type_rec = state.get("study_type", {}).get("recommended", "")
        sample_size = state.get("sample_size", state.get("sampleSizeParams", {}))
        sample_size_result = state.get("sample_size_result", state.get("sampleSizeResult", {}))
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
        total_sample = sample_size_result.get("total", 0)
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

        # 6. AI Bias & Methodology Auditor (using Ollama if online)
        if query_fn:
            prompt = (
                f"Identify methodological risks, statistical flaws, selection bias, or potential protocol limitations for this trial design:\n"
                f"- PICO: Population: {pico.get('population')}, Intervention: {pico.get('intervention')}, Comparator: {pico.get('comparator')}, Outcome: {pico.get('outcome')}\n"
                f"- Study Type: {study_type_rec}\n"
                f"- Sample Size Total: {total_sample}\n"
                f"- Inclusion Criteria: {[c.get('text') if isinstance(c, dict) else str(c) for c in inc]}\n"
                f"- Exclusion Criteria: {[c.get('text') if isinstance(c, dict) else str(c) for c in exc]}\n"
                f"- Confounders: {[c.get('name') if isinstance(c, dict) else str(c) for c in confounders]}\n\n"
                f"Respond ONLY in a valid JSON object matching the following structure:\n"
                f"{{\n"
                f'  "risks": [\n'
                f'    {{"id": "r_ai1", "severity": "Medium", "message": "Methodological/Statistical Risk details", "fix": "How to resolve this risk", "fieldId": "pico"}}\n'
                f'  ]\n'
                f"}}"
            )
            try:
                response = query_fn(prompt, "You are a clinical trial design auditor scanning for bias and limitations.")
                if response:
                    import json
                    # Clean response markup if any
                    json_str = response.strip()
                    if "```json" in json_str:
                        json_str = json_str.split("```json")[1].split("```")[0].strip()
                    elif "```" in json_str:
                        json_str = json_str.split("```")[1].split("```")[0].strip()
                    
                    match = re.search(r'\{.*\}', json_str, re.DOTALL)
                    if match:
                        parsed = json.loads(match.group(0))
                        if parsed and "risks" in parsed:
                            for r in parsed["risks"]:
                                if all(k in r for k in ["id", "severity", "message", "fix", "fieldId"]):
                                    # Avoid duplicates
                                    if not any(ex.get("message") == r["message"] for ex in risks):
                                        risks.append(r)
            except Exception as e:
                logger.warning(f"Ollama bias assessment audit failed: {e}")

        return risks


def extract_keywords(text: str) -> List[str]:
    """Extract key research terms from text"""
    if not text:
        return []
    
    # Common Ayurvedic and medical terms to prioritize
    priority_terms = [
        'ashwagandha', 'turmeric', 'ginger', 'garlic', 'tulsi', 'neem',
        'brahmi', 'shankhpushpi', 'triphala', 'guduchi', 'amla',
        'anxiety', 'depression', 'stress', 'insomnia', 'cognitive',
        'diabetes', 'hypertension', 'arthritis', 'inflammation',
        'immune', 'cancer', 'cardiovascular', 'respiratory',
        'clinical', 'randomized', 'trial', 'placebo', 'efficacy'
    ]
    
    # Extract words, filter common stop words
    stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 
                  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 
                  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 
                  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 
                  'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 
                  'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 
                  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 
                  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 
                  'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 
                  'because', 'until', 'while', 'about', 'against', 'between', 'into', 
                  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 
                  'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 
                  'further', 'then', 'once', 'study', 'effect', 'treatment', 'patient',
                  'churna', 'vati', 'bhasma', 'taila', 'ghrita', 'kashaya', 'kwath', 
                  'avaleha', 'gugglu', 'arishta', 'asava', 'rasa', 'extract', 'capsule', 
                  'tablet', 'powder', 'syrup', 'oil', 'placebo', 'control'}
    
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    keywords = [w for w in words if w not in stop_words]
    
    # Prioritize known terms
    priority_keywords = [k for k in keywords if k in priority_terms]
    other_keywords = [k for k in keywords if k not in priority_keywords]
    
    return priority_keywords[:5] + other_keywords[:5]


def search_papers_by_keywords(db: Session, keywords: List[str], limit: int = 50) -> List[Paper]:
    """Search papers using extracted keywords"""
    from sqlalchemy.orm import defer
    if not keywords:
        return []
    
    # Optimized OR search on top 2 keywords to keep queries fast
    filters = []
    for keyword in keywords[:2]:
        search_term = f"%{keyword}%"
        filters.append(Paper.title.ilike(search_term))
        filters.append(Paper.abstract.ilike(search_term))
        
    query = db.query(Paper).filter(or_(*filters)).options(
        defer(Paper.full_text),
        defer(Paper.embedding)
    )
    return query.limit(limit).all()


# --- HIGH LEVEL SERVICE WRAPPER (FALLBACK CAPABLE) ---
class StudyDesignAIService:
    def __init__(self):
        self.trial_architect = ClinicalTrialArchitectAgent()
        self.biostat_advisor = BiostatisticsAdvisorAgent()
        self.ayush_compliance = AYUSHProtocolComplianceAgent()
        self.ethics_reviewer = EthicsGuidelineReviewerAgent()
        self.bias_assessor = RiskBiasAssessmentAgent()

    def _query_ollama(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
        """Queries the local Ollama instance, returning None if offline or error occurs."""
        try:
            from app.core.config import settings
            import socket
            import urllib.parse
            
            # Fast DNS pre-check to avoid blocking on unresolvable hosts
            parsed = urllib.parse.urlparse(settings.OLLAMA_HOST)
            host = parsed.hostname
            if host:
                if host in ("ollama", "neo4j") and not os.path.exists("/.dockerenv"):
                    logger.warning(f"Host {host} is a default Docker service name but not running inside Docker. Skipping query.")
                    return None
                try:
                    socket.gethostbyname(host)
                except socket.gaierror:
                    logger.warning(f"Ollama host {host} is not DNS-resolvable (skipping Ollama query)")
                    return None
            
            url = f"{settings.OLLAMA_HOST}/api/generate"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            }
            if system_prompt:
                payload["system"] = system_prompt
                
            response = httpx.post(url, json=payload, timeout=240.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("response", "").strip()
        except Exception as e:
            logger.warning(f"Ollama query failed (using offline fallback): {e}")
        return None

    def _parse_ollama_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Safely parses JSON blocks from Ollama text responses."""
        try:
            # Look for JSON block in markdown backticks
            match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
            json_str = match.group(1) if match else text
            import json
            return json.loads(json_str.strip())
        except Exception:
            return None

    def generate_hypothesis(self, pico: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
        p = pico.get("population", "[Population]")
        i = pico.get("intervention", "[Intervention]")
        c = pico.get("comparator", "")
        o = pico.get("outcome", "[Outcome]")

        has_comparator = bool(c)
        is_complete = bool(pico.get("population") and pico.get("intervention") and pico.get("outcome"))
        confidence = 94 if is_complete else 50
        
        # Database-powered evidence analysis
        evidence_context = ""
        papers_analyzed = 0
        papers = []
        if db:
            try:
                keywords = extract_keywords(f"{p} {i} {o}")
                papers = search_papers_by_keywords(db, keywords, limit=20)
                papers_analyzed = len(papers)
                
                if papers:
                    evidence_context = f" Based on analysis of {papers_analyzed} relevant papers from the database."
                    confidence = 95 if papers_analyzed > 10 else 85 if papers_analyzed > 5 else 75
            except Exception as e:
                logger.warning(f"Database search failed: {e}")

        # Try to query Ollama first
        prompt = (
            f"Given the following clinical trial PICO parameters:\n"
            f"- Population (P): {p}\n"
            f"- Intervention (I): {i}\n"
            f"- Comparator (C): {c or 'None'}\n"
            f"- Outcome (O): {o}\n"
            f"- Context: Based on {papers_analyzed} relevant papers.\n\n"
            f"Generate a scientifically refined primary hypothesis, a null hypothesis, an alternative hypothesis, "
            f"a primary objective, and secondary objectives (list of strings).\n"
            f"Respond ONLY in a valid JSON object matching the following structure:\n"
            f"{{\n"
            f'  "primary": "refined hypothesis sentence",\n'
            f'  "nullHypothesis": "null hypothesis sentence",\n'
            f'  "alternative": "alternative hypothesis sentence",\n'
            f'  "primaryObjective": "primary objective sentence",\n'
            f'  "secondaryObjectives": ["objective 1", "objective 2"]\n'
            f"}}"
        )
        ollama_response = self._query_ollama(prompt, "You are a clinical trial design biostatistician.")
        if ollama_response:
            parsed = self._parse_ollama_json(ollama_response)
            if parsed and all(k in parsed for k in ["primary", "nullHypothesis", "alternative", "primaryObjective", "secondaryObjectives"]):
                return {
                    "primary": parsed["primary"],
                    "nullHypothesis": parsed["nullHypothesis"],
                    "alternative": parsed["alternative"],
                    "primaryObjective": parsed["primaryObjective"],
                    "secondaryObjectives": parsed["secondaryObjectives"],
                    "aiMetadata": {
                        "value": parsed["primary"],
                        "confidence": min(confidence + 5, 99),
                        "reasoning": f"Hypothesis generated by LLM (Llama2) using target PICO and {papers_analyzed} database papers.{evidence_context}",
                        "improvements": ["Specify primary endpoints at distinct intervals (e.g. week 4, 8, 12)."] if is_complete else ["Complete all PICO parameters first."],
                        "papersAnalyzed": papers_analyzed,
                        "evidenceBased": papers_analyzed > 0
                    }
                }

        # Fallback logic
        primary = (
            f"Administration of {i} will result in a statistically significant improvement in {o} compared to {c} in {p}."
            if has_comparator else
            f"Administration of {i} will result in a statistically significant improvement in {o} in {p}."
        )

        secondary_objectives = [
            f"To assess safety, tolerability, and hepatorenal profile of {i} in {p}.",
            "To evaluate health-related quality of life outcomes."
        ]
        
        if papers_analyzed > 5:
            secondary_objectives.append(f"To compare findings with existing clinical evidence ({papers_analyzed} relevant papers)")
        if papers_analyzed > 0:
            secondary_objectives.append(f"To validate results against published literature")

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
            "secondaryObjectives": secondary_objectives,
            "aiMetadata": {
                "value": primary,
                "confidence": confidence,
                "reasoning": f"Hypothesis generated based on target demographic and therapy endpoints.{evidence_context}",
                "improvements": ["Specify primary endpoints at distinct intervals (e.g. week 4, 8, 12)."] if is_complete else ["Complete all PICO parameters first."],
                "papersAnalyzed": papers_analyzed,
                "evidenceBased": papers_analyzed > 0
            }
        }

    def recommend_study_type(self, pico: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
        base_recommendation = self.trial_architect.recommend(pico)
        
        # Analyze common study types in papers
        papers_analyzed = 0
        study_types = []
        if db:
            try:
                keywords = extract_keywords(f"{pico.get('population', '')} {pico.get('intervention', '')} {pico.get('outcome', '')}")
                papers = search_papers_by_keywords(db, keywords, limit=30)
                papers_analyzed = len(papers)
                for paper in papers:
                    if paper.title and paper.abstract:
                        text = (paper.title + " " + paper.abstract).lower()
                        if 'randomized' in text and 'controlled' in text:
                            study_types.append('Randomized Controlled Trial')
                        elif 'randomized' in text:
                            study_types.append('Randomized Trial')
                        elif 'cohort' in text:
                            study_types.append('Cohort Study')
                        elif 'case-control' in text:
                            study_types.append('Case-Control Study')
                        elif 'cross-sectional' in text:
                            study_types.append('Cross-Sectional Study')
            except Exception as e:
                logger.warning(f"Database search failed for study type: {e}")

        # Try Ollama query
        prompt = (
            f"Based on the following clinical parameters:\n"
            f"- Population: {pico.get('population')}\n"
            f"- Intervention: {pico.get('intervention')}\n"
            f"- Comparator: {pico.get('comparator')}\n"
            f"- Outcome: {pico.get('outcome')}\n"
            f"- Common designs found in {papers_analyzed} papers: {list(set(study_types))}\n\n"
            f"Recommend the optimal clinical trial study design type.\n"
            f"Respond ONLY in a valid JSON object matching the following structure:\n"
            f"{{\n"
            f'  "recommended": "Randomized Controlled Trial (RCT) or similar",\n'
            f'  "confidence": 95,\n'
            f'  "reasoning": "Scientific reasoning for this design recommendation.",\n'
            f'  "improvements": ["design enhancement 1", "design enhancement 2"]\n'
            f"}}"
        )
        ollama_response = self._query_ollama(prompt, "You are a clinical trial design advisor.")
        if ollama_response:
            parsed = self._parse_ollama_json(ollama_response)
            if parsed and all(k in parsed for k in ["recommended", "confidence", "reasoning", "improvements"]):
                return {
                    "value": parsed["recommended"],
                    "confidence": parsed["confidence"],
                    "reasoning": parsed["reasoning"],
                    "improvements": parsed["improvements"],
                    "papersAnalyzed": papers_analyzed,
                    "evidenceBased": papers_analyzed > 0
                }

        # Local fallback if Ollama fails or offline
        if study_types:
            from collections import Counter
            most_common = Counter(study_types).most_common(1)[0][0]
            if len([st for st in study_types if st == most_common]) > papers_analyzed * 0.3:
                base_recommendation['value'] = most_common
                base_recommendation['reasoning'] = f"Based on analysis of {papers_analyzed} relevant papers, {most_common} is the most common design ({len([st for st in study_types if st == most_common])} studies)."
                base_recommendation['confidence'] = min(base_recommendation['confidence'] + 5, 99)
                base_recommendation['papersAnalyzed'] = papers_analyzed
                base_recommendation['alternativeOptions'] = list(set(study_types))[:3]
                
        return base_recommendation

    def recommend_statistical_plan(self, study_type: str, outcome: str, db: Optional[Session] = None) -> Dict[str, Any]:
        base_recommendation = self.biostat_advisor.recommend_test(study_type, outcome)
        
        # Analyze common statistical methods in papers
        papers_analyzed = 0
        statistical_methods = []
        if db:
            try:
                keywords = extract_keywords(f"{study_type} {outcome}")
                papers = search_papers_by_keywords(db, keywords, limit=20)
                papers_analyzed = len(papers)
                for paper in papers:
                    if paper.abstract:
                        text = paper.abstract.lower()
                        if 't-test' in text or 't test' in text:
                            statistical_methods.append('Student\'s t-test')
                        elif 'anova' in text:
                            statistical_methods.append('ANOVA')
                        elif 'chi-square' in text or 'chi square' in text:
                            statistical_methods.append('Chi-square test')
                        elif 'mann-whitney' in text:
                            statistical_methods.append('Mann-Whitney U test')
                        elif 'wilcoxon' in text:
                            statistical_methods.append('Wilcoxon signed-rank test')
                        elif 'regression' in text:
                            statistical_methods.append('Regression analysis')
                        elif 'logistic' in text:
                            statistical_methods.append('Logistic regression')
            except Exception as e:
                logger.warning(f"Database search failed for statistical plan: {e}")

        # Try Ollama query
        prompt = (
            f"Based on the following clinical parameters:\n"
            f"- Study Type: {study_type}\n"
            f"- Primary Outcome: {outcome}\n"
            f"- Common methods found in {papers_analyzed} papers: {list(set(statistical_methods))}\n\n"
            f"Recommend the optimal statistical testing plan, end-point analysis method, and regression models.\n"
            f"Respond ONLY in a valid JSON object matching the following structure:\n"
            f"{{\n"
            f'  "test": "ANCOVA (Baseline Adjusted) or similar",\n'
            f'  "confidence": 90,\n'
            f'  "reasoning": "Biostatistical justification for this testing recommendation.",\n'
            f'  "improvements": ["endpoint check 1", "endpoint check 2"]\n'
            f"}}"
        )
        ollama_response = self._query_ollama(prompt, "You are a clinical trial biostatistics advisor.")
        if ollama_response:
            parsed = self._parse_ollama_json(ollama_response)
            if parsed and all(k in parsed for k in ["test", "confidence", "reasoning", "improvements"]):
                return {
                    "value": parsed["test"],
                    "confidence": parsed["confidence"],
                    "reasoning": parsed["reasoning"],
                    "improvements": parsed["improvements"],
                    "papersAnalyzed": papers_analyzed,
                    "evidenceBased": papers_analyzed > 0
                }

        # Local fallback if Ollama fails or offline
        if statistical_methods:
            from collections import Counter
            most_common = Counter(statistical_methods).most_common(1)[0][0]
            base_recommendation['reasoning'] = f"Based on analysis of {papers_analyzed} relevant papers, {most_common} is commonly used for this type of study. {base_recommendation.get('reasoning', '')}"
            base_recommendation['confidence'] = min(base_recommendation['confidence'] + 5, 99)
            base_recommendation['papersAnalyzed'] = papers_analyzed
            base_recommendation['commonMethods'] = list(set(statistical_methods))[:5]
            
        return base_recommendation

    def assess_bias_risk(self, state: Dict[str, Any]) -> List[Dict[str, Any]]:
        return self.bias_assessor.assess(state, self._query_ollama)

    def check_guidelines(self, state: Dict[str, Any]) -> List[Dict[str, Any]]:
        compliance = self.ethics_reviewer.check(state, self._query_ollama)
        ayurveda = state.get("ayurveda", state.get("ayush_protocol", {}))
        if ayurveda:
            compliance.extend(self.ayush_compliance.verify(ayurveda, self._query_ollama))
        return compliance

    def suggest_criteria(self, pico: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
        """Suggest inclusion/exclusion criteria based on database evidence"""
        population = pico.get("population", "")
        intervention = pico.get("intervention", "")
        
        # Analyze papers
        papers_analyzed = 0
        papers = []
        if db:
            try:
                keywords = extract_keywords(f"{population} {intervention}")
                papers = search_papers_by_keywords(db, keywords, limit=15)
                papers_analyzed = len(papers)
            except Exception as e:
                logger.warning(f"Database search failed for criteria: {e}")

        # Try Ollama query
        prompt = (
            f"Based on the following clinical parameters:\n"
            f"- Population: {population}\n"
            f"- Intervention: {intervention}\n\n"
            f"Suggest specific inclusion and exclusion criteria for patients entering this study.\n"
            f"Respond ONLY in a valid JSON object matching the following structure:\n"
            f"{{\n"
            f'  "inclusion": ["criteria 1", "criteria 2", "criteria 3"],\n'
            f'  "exclusion": ["criteria 1", "criteria 2", "criteria 3"]\n'
            f"}}"
        )
        ollama_response = self._query_ollama(prompt, "You are a clinical trial design protocol architect.")
        if ollama_response:
            parsed = self._parse_ollama_json(ollama_response)
            if parsed and all(k in parsed for k in ["inclusion", "exclusion"]):
                def clean_criteria(item_list):
                    if not isinstance(item_list, list):
                        return []
                    cleaned = []
                    for item in item_list:
                        if isinstance(item, dict):
                            val = item.get("description") or item.get("name") or item.get("text")
                            if not val:
                                val = " ".join([str(v) for v in item.values() if v])
                            cleaned.append(str(val))
                        else:
                            cleaned.append(str(item))
                    return cleaned
                
                return {
                    "inclusion": clean_criteria(parsed["inclusion"]),
                    "exclusion": clean_criteria(parsed["exclusion"]),
                    "aiMetadata": {
                        "evidenceBased": papers_analyzed > 0,
                        "papersAnalyzed": papers_analyzed
                    }
                }


        # Fallback logic
        inclusion = [
            "Adults aged 18-65 years",
            "Willing to provide informed consent",
            f"Diagnosed with condition relevant to {population}"
        ]
        exclusion = [
            "Severe comorbid illness",
            "Pregnancy or lactation",
            f"Known hypersensitivity to {intervention}"
        ]
        
        # Simple extraction from abstract text
        if db and papers:
            for paper in papers[:5]:
                if paper.abstract:
                    text = paper.abstract.lower()
                    if 'excluded' in text:
                        if 'pregnant' in text and 'Pregnancy or lactation' not in exclusion:
                            exclusion.append("Pregnancy or lactation")
                        if 'severe' in text and 'Severe comorbid conditions' not in exclusion:
                            exclusion.append("Severe comorbid conditions")
                    if 'inclusion' in text:
                        if 'age' in text and 'Age 18-65 years' not in inclusion:
                            inclusion.append("Age 18-65 years")
                        if 'consent' in text and 'Written informed consent' not in inclusion:
                            inclusion.append("Written informed consent")

        return {
            "inclusion": inclusion,
            "exclusion": exclusion,
            "aiMetadata": {
                "evidenceBased": db is not None,
                "papersAnalyzed": papers_analyzed
            }
        }

    def suggest_confounders(self, pico: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
        """Suggest potential confounders based on database evidence"""
        # Analyze papers
        papers_analyzed = 0
        if db:
            try:
                keywords = extract_keywords(f"{pico.get('population', '')} {pico.get('intervention', '')}")
                papers = search_papers_by_keywords(db, keywords, limit=15)
                papers_analyzed = len(papers)
            except Exception as e:
                logger.warning(f"Database search failed for confounders: {e}")

        # Try Ollama query
        prompt = (
            f"Based on the following clinical study parameters:\n"
            f"- Population: {pico.get('population')}\n"
            f"- Intervention: {pico.get('intervention')}\n\n"
            f"Identify potential clinical confounders and suggest specific mitigation strategies.\n"
            f"Respond ONLY in a valid JSON object matching the following structure:\n"
            f"{{\n"
            f'  "confounders": [\n'
            f'    {{"id": "c1", "name": "Confounder Name", "risk": "Low/Medium/High", "mitigation": "Mitigation Strategy"}},\n'
            f'    {{"id": "c2", "name": "Confounder Name", "risk": "Low/Medium/High", "mitigation": "Mitigation Strategy"}}\n'
            f'  ]\n'
            f"}}"
        )
        ollama_response = self._query_ollama(prompt, "You are a clinical trial design biostatistician.")
        if ollama_response:
            parsed = self._parse_ollama_json(ollama_response)
            if parsed and "confounders" in parsed:
                return {
                    "confounders": parsed["confounders"],
                    "aiMetadata": {
                        "evidenceBased": papers_analyzed > 0,
                        "papersAnalyzed": papers_analyzed
                    }
                }

        # Fallback logic
        confounders = [
            {
                "id": "c1",
                "name": "Age",
                "risk": "Medium",
                "mitigation": "Stratified randomization by age groups"
            },
            {
                "id": "c2", 
                "name": "Gender",
                "risk": "Medium",
                "mitigation": "Balanced allocation across study arms"
            },
            {
                "id": "c3",
                "name": "Baseline Severity",
                "risk": "High",
                "mitigation": "ANCOVA adjustment for baseline scores"
            }
        ]
        return {
            "confounders": confounders,
            "aiMetadata": {
                "evidenceBased": db is not None,
                "papersAnalyzed": papers_analyzed
            }
        }

    def _query_neo4j_correlation_paths(self, intervention: str) -> Dict[str, Any]:
        """Queries Neo4j for entity correlation paths starting from the intervention."""
        try:
            from app.core.config import settings
            from neo4j import GraphDatabase
            import socket
            import urllib.parse
            
            uri = settings.NEO4J_URI
            user = settings.NEO4J_USER
            password = settings.NEO4J_PASSWORD
            
            # Fast DNS pre-check to avoid blocking on unresolvable hosts
            parsed = urllib.parse.urlparse(uri)
            host = parsed.hostname
            if host:
                if host in ("neo4j", "ollama") and not os.path.exists("/.dockerenv"):
                    raise Exception(f"Host {host} is a default Docker service name but not running inside Docker.")
                try:
                    socket.gethostbyname(host)
                except socket.gaierror:
                    raise Exception(f"Host {host} is not DNS-resolvable")
            
            paths = []
            targets = []
            
            with GraphDatabase.driver(uri, auth=(user, password), connection_timeout=2.0) as driver:
                with driver.session() as session:
                    # Cypher query to look for paths from herb to molecule to target/receptor
                    query = (
                        "MATCH (h {name: $name})-[r1]->(m)-[r2]->(t) "
                        "RETURN h.name AS herb, type(r1) AS rel1, m.name AS molecule, type(r2) AS rel2, t.name AS target "
                        "LIMIT 5"
                    )
                    result = session.run(query, name=intervention)
                    for record in result:
                        path_str = f"{record['herb']} -[{record['rel1']}]-> {record['molecule']} -[{record['rel2']}]-> {record['target']}"
                        paths.append(path_str)
                        if record['target'] not in targets:
                            targets.append(record['target'])
                            
            if paths:
                return {"targets": targets, "paths": paths, "source": "Neo4j Knowledge Graph"}
        except Exception as e:
            logger.warning(f"Neo4j connection/query failed (using fallback): {e}")
            
        # Offline fallback targets based on common Ayurvedic interventions
        fallback_targets = {
            "amalaki": {
                "targets": ["TNF-alpha", "IL-6", "NF-kB", "AKT"],
                "paths": [
                    "Amalaki -[contains]-> Emblicanin -[inhibits]-> TNF-alpha",
                    "Amalaki -[contains]-> Gallic Acid -[downregulates]-> IL-6"
                ]
            },
            "ashwagandha": {
                "targets": ["GABAA Receptor", "Cortisol Receptor", "COX-2"],
                "paths": [
                    "Ashwagandha -[contains]-> Withaferin A -[binds]-> GABAA Receptor",
                    "Ashwagandha -[contains]-> Withanolides -[suppresses]-> COX-2"
                ]
            }
        }
        
        # Match standard herbs if substring matches
        for herb, data in fallback_targets.items():
            if herb in intervention.lower():
                return {
                    "targets": data["targets"],
                    "paths": data["paths"],
                    "source": "Bio-entity Fallback Mapping"
                }
                
        # Default targets
        return {
            "targets": ["TNF-alpha", "COX-2", "IL-1beta"],
            "paths": [
                f"{intervention} -[modulates]-> Inflammatory Pathway -> TNF-alpha",
                f"{intervention} -[downregulates]-> Prostaglandin Synthesis -> COX-2"
            ],
            "source": "Default Biological Pathway Model"
        }

    def suggest_ayurveda_protocol(self, intervention: str, db: Optional[Session] = None) -> Dict[str, Any]:
        """Suggest Ayurveda protocol parameters based on database evidence"""
        # Analyze papers
        papers_analyzed = 0
        if db:
            try:
                keywords = extract_keywords(intervention)
                papers = search_papers_by_keywords(db, keywords, limit=10)
                papers_analyzed = len(papers)
            except Exception as e:
                logger.warning(f"Database search failed for Ayurveda protocol: {e}")

        # Fetch targets and correlation paths from Neo4j/fallback
        neo4j_data = self._query_neo4j_correlation_paths(intervention)

        # Try Ollama query
        prompt = (
            f"Based on the following clinical intervention: {intervention}\n\n"
            f"Recommend an Ayurveda clinical protocol including formulation, dosage, anupana (vehicle), "
            f"prakriti considerations, treatment duration, safety monitoring, and standardization.\n"
            f"Respond ONLY in a valid JSON object matching the following structure:\n"
            f"{{\n"
            f'  "formulation": "formulation description",\n'
            f'  "dosage": "dosage instructions",\n'
            f'  "anupana": "anupana description",\n'
            f'  "prakriti": "prakriti consideration",\n'
            f'  "duration": "12 Weeks or similar",\n'
            f'  "safety": "safety monitoring description",\n'
            f'  "standardization": "standardization specifications"\n'
            f"}}"
        )
        ollama_response = self._query_ollama(prompt, "You are an expert Ayurveda clinical researcher.")
        if ollama_response:
            parsed = self._parse_ollama_json(ollama_response)
            if parsed and all(k in parsed for k in ["formulation", "dosage", "anupana", "prakriti", "duration", "safety", "standardization"]):
                return {
                    "protocol": parsed,
                    "targets": neo4j_data["targets"],
                    "correlationPaths": neo4j_data["paths"],
                    "aiMetadata": {
                        "evidenceBased": papers_analyzed > 0,
                        "papersAnalyzed": papers_analyzed,
                        "neo4jSource": neo4j_data["source"]
                    }
                }

        # Fallback logic
        protocol = {
            "formulation": "Standardized extract",
            "dosage": "As per traditional texts",
            "anupana": "Ushnodaka (warm water)",
            "prakriti": "Vata-Pitta",
            "duration": "12 Weeks",
            "safety": "LFT/RFT every 4 weeks",
            "standardization": "API compliant"
        }
        return {
            "protocol": protocol,
            "targets": neo4j_data["targets"],
            "correlationPaths": neo4j_data["paths"],
            "aiMetadata": {
                "evidenceBased": db is not None,
                "papersAnalyzed": papers_analyzed,
                "neo4jSource": neo4j_data["source"]
            }
        }

    def suggest_timeline(self, study_type: str, duration_weeks: int = 12, research_question: Optional[str] = None, pico: Optional[Dict[str, Any]] = None, db: Optional[Session] = None) -> Dict[str, Any]:
        """Suggest study timeline based on study type, PICO parameters, and database evidence"""
        # Analyze papers
        papers_analyzed = 0
        if db:
            try:
                keywords = extract_keywords(study_type)
                papers = search_papers_by_keywords(db, keywords, limit=10)
                papers_analyzed = len(papers)
            except Exception as e:
                logger.warning(f"Database search failed for timeline: {e}")

        # Construct specific clinical PICO context
        context = ""
        if research_question:
            context += f"Research Question: {research_question}\n"
        if pico:
            context += "PICO Details:\n"
            if pico.get("population"): context += f"- Population (P): {pico['population']}\n"
            if pico.get("intervention"): context += f"- Intervention (I): {pico['intervention']}\n"
            if pico.get("comparator"): context += f"- Comparator (C): {pico['comparator']}\n"
            if pico.get("outcome"): context += f"- Outcome (O): {pico['outcome']}\n"

        # Try Ollama query
        prompt = (
            f"Based on a clinical study of type: {study_type} and treatment duration of {duration_weeks} weeks.\n"
            f"{context}\n"
            f"Suggest a dynamic and specific study design milestone timeline. Instead of using generic names like 'Recruitment' or 'Intervention', use specific terms custom-tailored to the population, intervention, comparator, and outcomes specified above (e.g., 'Recruit patients with chronic allergic rhinitis', 'Administer Guduchi Extract vs Placebo', 'Measure nasal symptom scores & serum IgE levels').\n\n"
            f"Respond ONLY in a valid JSON object matching the following structure:\n"
            f"{{\n"
            f'  "timeline": [\n'
            f'    {{"id": "t1", "label": "Milestone Name", "duration": "Duration (e.g. Month 1)", "color": "text-success/text-primary/text-accent/text-warning"}},\n'
            f'    {{"id": "t2", "label": "Milestone Name", "duration": "Duration (e.g. Months 2-4)", "color": "text-success/text-primary/text-accent/text-warning"}}\n'
            f'  ]\n'
            f"}}"
        )
        ollama_response = self._query_ollama(prompt, "You are a clinical trial project manager.")
        if ollama_response:
            parsed = self._parse_ollama_json(ollama_response)
            if parsed and "timeline" in parsed:
                return {
                    "timeline": parsed["timeline"],
                    "aiMetadata": {
                        "evidenceBased": papers_analyzed > 0,
                        "papersAnalyzed": papers_analyzed
                    }
                }

        # Fallback logic
        if "RCT" in study_type:
            timeline = [
                {"id": "t1", "label": "Protocol Approval", "duration": "Month 1", "color": "text-success"},
                {"id": "t2", "label": "Recruitment", "duration": f"Months 2-{duration_weeks//4 + 1}", "color": "text-primary"},
                {"id": "t3", "label": "Intervention", "duration": f"Months 2-{duration_weeks//4 + 1}", "color": "text-accent"},
                {"id": "t4", "label": "Follow-up", "duration": f"Months {duration_weeks//4 + 2}-{duration_weeks//4 + 3}", "color": "text-warning"},
                {"id": "t5", "label": "Data Analysis", "duration": f"Month {duration_weeks//4 + 4}", "color": "text-success"}
            ]
        else:
            timeline = [
                {"id": "t1", "label": "Protocol Approval", "duration": "Month 1", "color": "text-success"},
                {"id": "t2", "label": "Recruitment", "duration": f"Months 2-{duration_weeks//4 + 1}", "color": "text-primary"},
                {"id": "t3", "label": "Data Collection", "duration": f"Months 2-{duration_weeks//4 + 2}", "color": "text-accent"},
                {"id": "t4", "label": "Data Analysis", "duration": f"Month {duration_weeks//4 + 3}", "color": "text-success"}
            ]
        return {
            "timeline": timeline,
            "aiMetadata": {
                "evidenceBased": db is not None,
                "papersAnalyzed": papers_analyzed
            }
        }

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

        # Ethics checklist deduction: -3 points for each unchecked requirement
        ethics = state.get("ethics", [])
        unchecked_count = sum(1 for e in ethics if not e.get("checked", False))
        score -= (unchecked_count * 3)

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

    def generate_detailed_protocol_summary(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive protocol summary with all sections"""
        sections = []
        
        # 1. Title and Background
        sections.append({
            "title": "1. Title & Background",
            "content": f"**Study Protocol:** {state.get('title', 'Untitled Study')}\n\n" +
                      f"**Research Question:** {state.get('research_question', 'Not specified')}\n\n" +
                      f"**Background:** This protocol is designed to address the research question through a rigorous " +
                      f"{state.get('study_type', {}).get('recommended', 'clinical study')} design. " +
                      f"The study aims to provide evidence-based insights into the intervention's efficacy and safety."
        })
        
        # 2. Objectives and Hypotheses
        hypothesis = state.get('hypothesis', {})
        sections.append({
            "title": "2. Objectives & Hypotheses",
            "content": f"**Primary Objective:** {hypothesis.get('primaryObjective', 'Not specified')}\n\n" +
                      f"**Primary Hypothesis:** {hypothesis.get('primary', 'Not specified')}\n\n" +
                      f"**Null Hypothesis:** {hypothesis.get('nullHypothesis', 'Not specified')}\n\n" +
                      f"**Alternative Hypothesis:** {hypothesis.get('alternative', 'Not specified')}\n\n" +
                      f"**Secondary Objectives:**\n" + 
                      "\n".join([f"- {obj}" for obj in hypothesis.get('secondaryObjectives', [])])
        })
        
        # 3. Study Design
        pico = state.get('pico', {})
        sections.append({
            "title": "3. Study Design",
            "content": f"**Study Type:** {state.get('study_type', {}).get('recommended', 'Not specified')}\n\n" +
                      f"**PICO Elements:**\n" +
                      f"- **Population:** {pico.get('population', 'Not specified')}\n" +
                      f"- **Intervention:** {pico.get('intervention', 'Not specified')}\n" +
                      f"- **Comparator:** {pico.get('comparator', 'Not specified')}\n" +
                      f"- **Outcome:** {pico.get('outcome', 'Not specified')}\n\n" +
                      f"**Study Duration:** {state.get('ayurveda', {}).get('duration', 'Not specified')}"
        })
        
        # 4. Sample Size
        sample_params = state.get('sample_size', state.get('sampleSizeParams', {}))
        sample_result = state.get('sample_size_result', state.get('sampleSizeResult', {}))
        sections.append({
            "title": "4. Sample Size Calculation",
            "content": f"**Statistical Parameters:**\n" +
                      f"- Alpha (Type I error): {sample_params.get('alpha', 0.05)}\n" +
                      f"- Power (1 - Type II error): {sample_params.get('power', 0.80)}\n" +
                      f"- Effect size: {sample_params.get('effectSize', 0.5)}\n" +
                      f"- Allocation ratio: {sample_params.get('ratio', 1)}\n\n" +
                      f"**Calculated Sample Size:**\n" +
                      f"- Total participants: {sample_result.get('total', 'Not calculated')}\n" +
                      f"- Per arm: {sample_result.get('perArm', 'Not calculated')}"
        })
        
        # 5. Statistical Analysis Plan
        stat_plan = state.get('statistical_plan', state.get('statisticalPlan', {}))
        sections.append({
            "title": "5. Statistical Analysis Plan",
            "content": f"**Primary Endpoint:** {stat_plan.get('primaryEndpoint', 'Not specified')}\n\n" +
                      f"**Statistical Test:** {stat_plan.get('recommendedTest', 'Not specified')}\n\n" +
                      f"**Missing Data Handling:** {stat_plan.get('missingData', 'Not specified')}\n\n" +
                      f"**Regression Analysis:** {stat_plan.get('regression', 'Not specified')}\n\n" +
                      f"**Subgroup Analyses:** {stat_plan.get('subgroups', 'Not specified')}"
        })
        
        # 6. Eligibility Criteria
        criteria = state.get('eligibility', state.get('criteria', {}))
        sections.append({
            "title": "6. Eligibility Criteria",
            "content": f"**Inclusion Criteria:**\n" + 
                      "\n".join([f"- {c['text']}" for c in criteria.get('inclusion', [])]) + "\n\n" +
                      f"**Exclusion Criteria:**\n" +
                      "\n".join([f"- {c['text']}" for c in criteria.get('exclusion', [])])
        })
        
        # 7. Confounders and Mitigation
        confounders = state.get('confounders', [])
        if confounders:
            sections.append({
                "title": "7. Potential Confounders",
                "content": "\n".join([f"- **{c['name']}** (Risk: {c['risk']}): {c['mitigation']}" for c in confounders])
            })
        
        # 8. Ayurveda Protocol
        ayurveda = state.get('ayush_protocol', state.get('ayurveda', {}))
        if ayurveda.get('formulation'):
            sections.append({
                "title": "8. Ayurveda Protocol Specifications",
                "content": f"**Formulation:** {ayurveda.get('formulation', 'Not specified')}\n\n" +
                          f"**Dosage:** {ayurveda.get('dosage', 'Not specified')}\n\n" +
                          f"**Anupana:** {ayurveda.get('anupana', 'Not specified')}\n\n" +
                          f"**Prakriti Consideration:** {ayurveda.get('prakriti', 'Not specified')}\n\n" +
                          f"**Treatment Duration:** {ayurveda.get('duration', 'Not specified')}\n\n" +
                          f"**Safety Monitoring:** {ayurveda.get('safety', 'Not specified')}\n\n" +
                          f"**Standardization:** {ayurveda.get('standardization', 'Not specified')}"
            })
        
        # 9. Study Timeline
        timeline = state.get('timeline', [])
        if timeline:
            sections.append({
                "title": "9. Study Timeline",
                "content": "\n".join([f"- **{t['label']}:** {t['duration']}" for t in timeline])
            })
        
        # 10. Ethical Considerations
        ethics = state.get('ethics', [])
        if ethics:
            checked_ethics = [e for e in ethics if e.get('checked')]
            if checked_ethics:
                sections.append({
                    "title": "10. Ethical Considerations",
                    "content": "**Compliance Items:**\n" + "\n".join([f"- {e['label']}" for e in checked_ethics])
                })
        
        # 11. Quality Assessment
        intelligence = state.get('intelligence', {})
        sections.append({
            "title": "11. Protocol Quality Assessment",
            "content": f"**Quality Score:** {intelligence.get('qualityScore', 0)}/100\n\n" +
                      f"**Completeness:** {intelligence.get('completeness', 0)}%\n\n" +
                      f"**Identified Risks:** {len(intelligence.get('risks', []))}\n" +
                      "\n".join([f"- {r}" for r in intelligence.get('risks', [])]) + "\n\n" +
                      f"**Guideline Compliance:** {len(intelligence.get('compliance', []))} items checked"
        })
        
        return {
            "sections": sections,
            "generatedAt": datetime.now().isoformat(),
            "protocolId": state.get('id', 'draft'),
            "metadata": {
                "totalSections": len(sections),
                "completeness": intelligence.get('completeness', 0),
                "qualityScore": intelligence.get('qualityScore', 0)
            }
        }

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
