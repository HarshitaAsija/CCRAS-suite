from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.services.study_design_ai import ai_service

router = APIRouter(prefix="/study-design", tags=["study-design"])

# --- INPUT SCHEMAS ---
class PicoRequest(BaseModel):
    population: str
    intervention: str
    comparator: Optional[str] = ""
    outcome: str

class StatPlanRequest(BaseModel):
    studyType: str
    outcome: str

class ExportRequest(BaseModel):
    state: Dict[str, Any]
    format: str  # "markdown", "json", "html"

# --- ENDPOINTS ---

@router.post("/analyze")
def analyze_protocol_endpoint(payload: Dict[str, Any]):
    try:
        result = ai_service.analyze_protocol(payload)
        # Format dates / temporal fields manually to avoid SQLAlchemy issues
        result["lastCalculated"] = datetime.now().isoformat()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/generate-hypothesis")
def generate_hypothesis_endpoint(payload: PicoRequest):
    try:
        return ai_service.generate_hypothesis(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recommend-study-type")
def recommend_study_type_endpoint(payload: PicoRequest):
    try:
        return ai_service.recommend_study_type(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/statistical-plan")
def recommend_stat_plan_endpoint(payload: StatPlanRequest):
    try:
        return ai_service.recommend_statistical_plan(payload.studyType, payload.outcome)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bias-risk")
def assess_bias_risk_endpoint(payload: Dict[str, Any]):
    try:
        return ai_service.assess_bias_risk(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/guideline-check")
def guideline_check_endpoint(payload: Dict[str, Any]):
    try:
        return ai_service.check_guidelines(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/protocol-summary")
def protocol_summary_endpoint(payload: Dict[str, Any]):
    try:
        summary_text = ai_service.generate_summary(payload)
        return {"summary": summary_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export")
def export_protocol_endpoint(payload: ExportRequest):
    try:
        state = payload.state
        fmt = payload.format.lower()
        title = state.get("title", "Clinical Study Protocol")
        
        if fmt == "markdown":
            md = (
                f"# Study Protocol: {title}\n\n"
                f"## 1. Background & Rationale\n"
                f"{state.get('research_question', 'TBD')}\n\n"
                f"## 2. RISHI-AI Evidence Base & Objectives\n"
                f"**Primary Objective:** {state.get('hypothesis', {}).get('primaryObjective', 'TBD')}\n\n"
                f"### PICO parameters:\n"
                f"- **Population (P):** {state.get('pico', {}).get('population', 'TBD')}\n"
                f"- **Intervention (I):** {state.get('pico', {}).get('intervention', 'TBD')}\n"
                f"- **Comparator (C):** {state.get('pico', {}).get('comparator', 'None')}\n"
                f"- **Outcome (O):** {state.get('pico', {}).get('outcome', 'TBD')}\n\n"
                f"**Hypothesis (H1):** {state.get('hypothesis', {}).get('primary', 'TBD')}\n"
                f"**Null Hypothesis (H0):** {state.get('hypothesis', {}).get('nullHypothesis', 'TBD')}\n\n"
                f"## 3. Methodological Trial Design\n"
                f"- **Recommended Study Architecture:** {state.get('study_type', {}).get('recommended', 'TBD')}\n"
                f"- **Sample Size:** Total N={state.get('sample_size_result', {}).get('total', 0)} ({state.get('sample_size_result', {}).get('perArm', 0)} per study group)\n"
                f"- **Primary Hypothesis Test:** {state.get('statistical_plan', {}).get('recommendedTest', 'TBD')}\n"
                f"- **Adjustment Plan:** {state.get('statistical_plan', {}).get('regression', 'TBD')}\n\n"
            )
            
            # Ayurveda section
            ayur = state.get("ayurveda", state.get("ayush_protocol", {}))
            if ayur and ayur.get("formulation"):
                md += (
                    f"## 4. AYUSH Specific Traditional Interventions\n"
                    f"- **Formulation:** {ayur.get('formulation', 'TBD')}\n"
                    f"- **Dosage:** {ayur.get('dosage', 'TBD')}\n"
                    f"- **Anupana (Vehicle):** {ayur.get('anupana', 'TBD')}\n"
                    f"- **Target Prakriti:** {ayur.get('prakriti', 'TBD')}\n"
                    f"- **Quality Control & API Standardization:** {ayur.get('standardization', 'TBD')}\n"
                    f"- **Safety/LFT/RFT Screens:** {ayur.get('safety', 'TBD')}\n\n"
                )
            
            # Guidelines & Reviewer Summary
            md += (
                f"## 5. Protocol Reviewer Audit Report\n"
                f"{ai_service.generate_reviewer_report(state)}"
            )
            return {"content": md}
            
        elif fmt == "html":
            # Printable clinical format
            ayur = state.get("ayurveda", state.get("ayush_protocol", {}))
            ayur_html = ""
            if ayur and ayur.get("formulation"):
                ayur_html = (
                    f"<div class='section'><h2>4. AYUSH / Traditional Medicine Intervention</h2>"
                    f"<table>"
                    f"<tr><th>Formulation</th><td>{ayur.get('formulation', 'TBD')}</td></tr>"
                    f"<tr><th>Dosage</th><td>{ayur.get('dosage', 'TBD')}</td></tr>"
                    f"<tr><th>Anupana (Vehicle)</th><td>{ayur.get('anupana', 'TBD')}</td></tr>"
                    f"<tr><th>Target Prakriti</th><td>{ayur.get('prakriti', 'TBD')}</td></tr>"
                    f"<tr><th>QC Standardization</th><td>{ayur.get('standardization', 'TBD')}</td></tr>"
                    f"<tr><th>Safety Schedule</th><td>{ayur.get('safety', 'TBD')}</td></tr>"
                    f"</table></div>"
                )
                
            html = (
                f"<html><head><style>"
                f"body {{ font-family: 'Georgia', serif; line-height: 1.6; padding: 40px; color: #333; max-width: 800px; margin: auto; }}"
                f"h1 {{ text-align: center; font-size: 28px; margin-bottom: 5px; color: #1e293b; }}"
                f".subtitle {{ text-align: center; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 40px; }}"
                f"h2 {{ font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; color: #0f172a; margin-top: 30px; }}"
                f"p, li {{ font-size: 14px; text-align: justify; }}"
                f"table {{ wsl-width: 100%; border-collapse: collapse; margin: 15px 0; }}"
                f"th, td {{ border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }}"
                f"th {{ bg-color: #f1f5f9; font-weight: bold; }}"
                f".badge {{ display: inline-block; padding: 4px 8px; font-size: 10px; font-weight: bold; background: #e0f2fe; color: #0369a1; border-radius: 4px; }}"
                f"</style></head><body>"
                f"<h1>{title}</h1>"
                f"<div class='subtitle'>CCRAS Intelligence Suite • Brahma Study Architect</div>"
                
                f"<div class='section'><h2>1. Rationale & Research Question</h2>"
                f"<p>{state.get('research_question', 'TBD')}</p></div>"
                
                f"<div class='section'><h2>2. Hypotheses & Objectives</h2>"
                f"<p><strong>Primary Objective:</strong> {state.get('hypothesis', {}).get('primaryObjective', 'TBD')}</p>"
                f"<p><strong>Hypothesis (H1):</strong> {state.get('hypothesis', {}).get('primary', 'TBD')}</p>"
                f"<p><strong>Null Hypothesis (H0):</strong> {state.get('hypothesis', {}).get('nullHypothesis', 'TBD')}</p></div>"
                
                f"<div class='section'><h2>3. Clinical Methodology & Design</h2>"
                f"<table>"
                f"<tr><th>Study Design</th><td>{state.get('study_type', {}).get('recommended', 'TBD')}</td></tr>"
                f"<tr><th>Sample Size (N)</th><td>N={state.get('sample_size_result', {}).get('total', 0)} ({state.get('sample_size_result', {}).get('perArm', 0)} per arm)</td></tr>"
                f"<tr><th>Primary Test</th><td>{state.get('statistical_plan', {}).get('recommendedTest', 'TBD')}</td></tr>"
                f"<tr><th>Adjustment Regimen</th><td>{state.get('statistical_plan', {}).get('regression', 'TBD')}</td></tr>"
                f"</table></div>"
                
                f"{ayur_html}"
                
                f"</body></html>"
            )
            return {"content": html}
        else:
            return {"content": "JSON export is available via JSON download directly."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
