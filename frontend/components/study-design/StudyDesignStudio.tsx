"use client";
/* eslint-disable */
import React, { useState, useEffect } from "react";
import { Card } from "../shared/Card";
import { Badge } from "../shared/Badge";
import { Button } from "../shared/Button";
import { 
  ChevronRight, ChevronLeft, CheckCircle2, Circle, Edit3, 
  Database, Users, Activity, Target, HelpCircle, FileText, 
  Layers, Settings, Calculator, AlertTriangle, CheckSquare, List,
  X, Plus, RefreshCw, Copy, Download, Leaf, Brain, Microscope,
  ShieldAlert, ActivitySquare, Save, History, ChevronDown
} from "lucide-react";
import { 
  ProtocolState, ProtocolIntelligence, generateHypotheses, 
  recommendStudyType, recommendStatisticalTest, analyzeProtocol 
} from "../../lib/ai-architect";
import { 
  updateStudy, recommendStudyTypeAPI, generateHypothesisAPI, 
  recommendStatisticalPlanAPI, analyzeProtocolAPI, exportProtocolAPI, 
  exportProtocolDocxAPI, fetchProtocolSummaryAPI, validateEvidenceHandoff, 
  HandoffPayload, suggestCriteriaAPI, suggestConfoundersAPI, 
  suggestAyurvedaProtocolAPI, suggestTimelineAPI, fetchLiveBrahmaEvidenceHandoff
} from "../../lib/api";

const STEPS = [
  { id: "q", label: "Research Question" },
  { id: "h", label: "Evidence Handoff" },
  { id: "p", label: "PICO Builder" },
  { id: "hyp", label: "Hypotheses" },
  { id: "st", label: "Study Type" },
  { id: "ss", label: "Sample Size" },
  { id: "sp", label: "Statistical Plan" },
  { id: "cr", label: "Criteria" },
  { id: "co", label: "Confounders" },
  { id: "ay", label: "Ayurveda Protocol" },
  { id: "ti", label: "Timeline" },
  { id: "et", label: "Ethics" },
  { id: "ex", label: "Export" }
];

const DEFAULT_STATE: ProtocolState = {
  researchQuestion: "",
  pico: { population: "", intervention: "", comparator: "", outcome: "" },
  hypothesis: { 
    primary: "", nullHypothesis: "", alternative: "", primaryObjective: "", secondaryObjectives: [], isAuto: true 
  },
  studyType: { recommended: "", isAuto: true },
  sampleSizeParams: { alpha: 0.05, power: 0.80, effectSize: 0.5, ratio: 1 },
  sampleSizeResult: { total: 0, perArm: 0 },
  statisticalPlan: { primaryEndpoint: "", recommendedTest: "", missingData: "", regression: "", subgroups: "", isAuto: true },
  criteria: { inclusion: [], exclusion: [] },
  confounders: [],
  ayurveda: {
    formulation: "", dosage: "", anupana: "", prakriti: "", duration: "", safety: "", standardization: "",
    targets: [], correlationPaths: [], source: ""
  },
  timeline: [],
  ethics: [
    { id: "et1", label: "Ethics committee (IRB) approval", checked: false },
    { id: "et2", label: "Trial registration (ClinicalTrials.gov)", checked: false },
    { id: "et3", label: "Participant informed consent process documented", checked: false },
    { id: "et4", label: "Data privacy & HIPAA/DPDP compliance", checked: false },
    { id: "et5", label: "Safety monitoring board (DSMB) constituted", checked: false }
  ],
  handoffData: null,
  intelligence: {
    qualityScore: 0, completeness: 0, risks: [], compliance: [], lastCalculated: "", calculated: false
  }
};

export function StudyDesignStudio() {
  const [activeStep, setActiveStep] = useState(0);
  const [state, setState] = useState<ProtocolState>(DEFAULT_STATE);
  const [versions, setVersions] = useState<{ id: string; timestamp: string; state: ProtocolState }[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [rightPaneView, setRightPaneView] = useState<"intelligence" | "document" | "reviewer">("intelligence");
  
  // New API & UI statuses
  const [intelligenceMode, setIntelligenceMode] = useState<"ai" | "fallback">("ai");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "offline">("saved");
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  // Load from localStorage
  useEffect(() => {
    let initialState = { ...DEFAULT_STATE };
    
    const saved = localStorage.getItem("brahma_protocol_state");
    if (saved) {
      try { 
        const parsed = JSON.parse(saved); 
        const mappedState: any = { ...DEFAULT_STATE };
        
        if (parsed.id) mappedState.id = parsed.id;
        if (parsed.title) mappedState.title = parsed.title;
        
        mappedState.researchQuestion = parsed.researchQuestion || parsed.research_question || "";
        mappedState.pico = parsed.pico || DEFAULT_STATE.pico;
        
        mappedState.hypothesis = { 
          ...DEFAULT_STATE.hypothesis, 
          ...(parsed.hypothesis || {}) 
        };
        
        mappedState.studyType = { 
          ...DEFAULT_STATE.studyType, 
          ...(parsed.studyType || parsed.study_type || {}) 
        };
        
        mappedState.sampleSizeParams = parsed.sampleSizeParams || parsed.sample_size || DEFAULT_STATE.sampleSizeParams;
        mappedState.sampleSizeResult = parsed.sampleSizeResult || parsed.sample_size_result || DEFAULT_STATE.sampleSizeResult;
        
        mappedState.statisticalPlan = { 
          ...DEFAULT_STATE.statisticalPlan, 
          ...(parsed.statisticalPlan || parsed.statistical_plan || {}) 
        };
        
        mappedState.criteria = parsed.criteria || parsed.eligibility || DEFAULT_STATE.criteria;
        mappedState.confounders = parsed.confounders || DEFAULT_STATE.confounders;
        
        mappedState.ayurveda = { 
          ...DEFAULT_STATE.ayurveda, 
          ...(parsed.ayurveda || parsed.ayush_protocol || {}) 
        };
        
        mappedState.timeline = parsed.timeline || DEFAULT_STATE.timeline;
        mappedState.ethics = parsed.ethics || DEFAULT_STATE.ethics;
        
        // Map intelligence / scoring metadata
        mappedState.intelligence = {
          qualityScore: parsed.intelligence?.qualityScore ?? parsed.quality_score ?? 0,
          completeness: parsed.intelligence?.completeness ?? parsed.completeness ?? 0,
          risks: parsed.intelligence?.risks ?? parsed.risks ?? [],
          compliance: parsed.intelligence?.compliance ?? parsed.compliance ?? [],
          lastCalculated: parsed.intelligence?.lastCalculated ?? new Date().toISOString(),
          calculated: true
        };
        
        initialState = mappedState;
      } catch (e) { console.error("Failed to parse saved state", e); }
    }

    const handoff = localStorage.getItem("brahma_handoff_collection");
    if (handoff) {
      try { 
        const parsed = JSON.parse(handoff);
        initialState.handoffData = parsed;
        const seed = parsed.hypothesis_seed || parsed.hypothesisSeed;
        if (seed && !initialState.researchQuestion) {
          initialState.researchQuestion = seed;
        }
        const pico = parsed.pico_suggestion || parsed.picoSuggestion || parsed.pico;
        const ayurveda = parsed.ayurveda_suggestion || parsed.ayurvedaSuggestion || parsed.ayurveda;
        const title = parsed.title_suggestion || parsed.titleSuggestion || parsed.title;
        
        if (title && (!initialState.title || initialState.title === "Live Evidence Study Protocol")) {
          initialState.title = title;
        }
        if (pico) {
          initialState.pico = {
            population: pico.population || initialState.pico.population,
            intervention: pico.intervention || initialState.pico.intervention,
            comparator: pico.comparator || initialState.pico.comparator,
            outcome: pico.outcome || initialState.pico.outcome,
          };
        }
        if (ayurveda) {
          initialState.ayurveda = {
            ...initialState.ayurveda,
            ...ayurveda,
          };
        }
      } catch (e) { console.error(e); }
    }

    const savedVersions = localStorage.getItem("brahma_versions");
    if (savedVersions) {
      try { setVersions(JSON.parse(savedVersions)); } catch (e) {}
    }

    setState(initialState);
    setIsLoaded(true);
  }, []);

  // Save local versions
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("brahma_versions", JSON.stringify(versions));
    }
  }, [versions, isLoaded]);

  // Run Intelligence Engine (Scoring / Risks / Guidelines)
  useEffect(() => {
    if (!isLoaded) return;

    const triggerAnalyze = async () => {
      setLoadingIntelligence(true);
      try {
        const intel = await analyzeProtocolAPI(state);
        if (
          intel.qualityScore !== state.intelligence.qualityScore ||
          intel.completeness !== state.intelligence.completeness ||
          intel.risks.length !== state.intelligence.risks.length
        ) {
          setState(prev => ({ ...prev, intelligence: { ...prev.intelligence, ...intel, calculated: true } }));
        }
        setIntelligenceMode("ai");
      } catch (e) {
        setIntelligenceMode("fallback");
        // Rule-based client-side fallback
        const intel = analyzeProtocol(state);
        if (
          intel.qualityScore !== state.intelligence.qualityScore ||
          intel.completeness !== state.intelligence.completeness ||
          intel.risks.length !== state.intelligence.risks.length
        ) {
          setState(prev => ({ ...prev, intelligence: { ...prev.intelligence, ...intel, calculated: true } }));
        }
      } finally {
        setLoadingIntelligence(false);
      }
    };

    const delay = setTimeout(triggerAnalyze, 800); // Debounce analyzer
    return () => clearTimeout(delay);
  }, [
    state.researchQuestion,
    state.pico.population,
    state.pico.intervention,
    state.pico.comparator,
    state.pico.outcome,
    state.sampleSizeResult.total,
    state.criteria.inclusion,
    state.criteria.exclusion,
    state.confounders,
    state.ayurveda.formulation,
    state.ayurveda.dosage,
    state.ayurveda.standardization,
    state.ayurveda.safety,
    state.ethics,
    isLoaded
  ]);

  // Async AI Recommendations for PICO changes (Study type & Hypotheses)
  useEffect(() => {
    if (!isLoaded) return;
    
    const triggerAI = async () => {
      let updatedFields: Partial<ProtocolState> = {};
      let hasUpdates = false;

      // 1. Study Type Auto-rec
      if (state.pico.population && state.pico.intervention && state.studyType.isAuto) {
        setLoadingIntelligence(true);
        try {
          const rec = await recommendStudyTypeAPI(state.pico);
          updatedFields.studyType = { ...state.studyType, recommended: rec.value || rec.recommended, aiMetadata: rec };
          setIntelligenceMode("ai");
          hasUpdates = true;
        } catch (e) {
          setIntelligenceMode("fallback");
          const localRec = recommendStudyType(state.pico);
          updatedFields.studyType = { ...state.studyType, ...localRec };
          hasUpdates = true;
        }
      }

      // 2. Hypothesis Auto-gen
      if (state.pico.population && state.pico.intervention && state.hypothesis.isAuto) {
        setLoadingIntelligence(true);
        try {
          const hyp = await generateHypothesisAPI(state.pico);
          updatedFields.hypothesis = { ...state.hypothesis, ...hyp };
          setIntelligenceMode("ai");
          hasUpdates = true;
        } catch (e) {
          setIntelligenceMode("fallback");
          const localHyp = generateHypotheses(state.pico);
          updatedFields.hypothesis = { ...state.hypothesis, ...localHyp };
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        setState(prev => ({ ...prev, ...updatedFields }));
        setLoadingIntelligence(false);
      }
    };

    const delay = setTimeout(triggerAI, 1000); // Debounce
    return () => clearTimeout(delay);
  }, [state.pico.population, state.pico.intervention, state.pico.comparator, state.pico.outcome, state.studyType.isAuto, state.hypothesis.isAuto, isLoaded]);

  // Stat Plan Auto-rec
  useEffect(() => {
    if (!isLoaded || !state.statisticalPlan.isAuto) return;

    const triggerStatAI = async () => {
      try {
        const rec = await recommendStatisticalPlanAPI(state.studyType.recommended, state.pico.outcome);
        setState(prev => ({
          ...prev,
          statisticalPlan: {
            ...prev.statisticalPlan,
            recommendedTest: rec.value || "Pending",
            primaryEndpoint: prev.pico.outcome || "",
            aiMetadata: rec
          }
        }));
        setIntelligenceMode("ai");
      } catch (e) {
        setIntelligenceMode("fallback");
        const rec = recommendStatisticalTest(state.studyType.recommended, state.pico.outcome || "");
        setState(prev => ({
          ...prev,
          statisticalPlan: {
            ...prev.statisticalPlan,
            recommendedTest: rec?.value || "Pending",
            primaryEndpoint: prev.pico.outcome || "",
            aiMetadata: rec
          }
        }));
      }
    };

    triggerStatAI();
  }, [state.studyType.recommended, state.pico.outcome, state.statisticalPlan.isAuto, isLoaded]);

  // Autosave to Backend / Sync to localStorage fallback
  useEffect(() => {
    if (!isLoaded) return;

    // Local storage fallback
    localStorage.setItem("brahma_protocol_state", JSON.stringify(state));

    if (!state.id) {
      setSaveStatus("offline");
      return;
    }

    const triggerSave = async () => {
      setSaveStatus("saving");
      try {
        const payload = {
          title: state.title || "Untitled Study Protocol",
          research_question: state.researchQuestion,
          pico: state.pico,
          hypothesis: state.hypothesis,
          study_type: state.studyType,
          sample_size: state.sampleSizeParams,
          sample_size_result: state.sampleSizeResult,
          statistical_plan: state.statisticalPlan,
          eligibility: state.criteria,
          confounders: state.confounders,
          ayush_protocol: state.ayurveda,
          timeline: state.timeline,
          ethics: state.ethics,
          quality_score: state.intelligence.qualityScore,
          completeness: state.intelligence.completeness,
          risks: state.intelligence.risks,
          compliance: state.intelligence.compliance,
          snapshots: versions.map(v => ({ id: v.id, timestamp: v.timestamp, state: v.state }))
        };

        await updateStudy(state.id!, payload);
        setSaveStatus("saved");
      } catch (e) {
        console.error("Autosave failed", e);
        setSaveStatus("offline");
      }
    };

    const delay = setTimeout(triggerSave, 2000); // 2s debounce
    return () => clearTimeout(delay);
  }, [state, versions, isLoaded]);

  // Helper to compute inverse cumulative standard normal distribution
  const normSInv = (p: number): number => {
    if (p <= 0 || p >= 1) return 0;
    const q = p < 0.5 ? p : 1.0 - p;
    const t = Math.sqrt(-2.0 * Math.log(q));
    const c0 = 2.515517;
    const c1 = 0.802853;
    const c2 = 0.010328;
    const d1 = 1.432788;
    const d2 = 0.189269;
    const d3 = 0.001308;
    let x = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0);
    if (p < 0.5) x = -x;
    return x;
  };

  const updateState = (updates: Partial<ProtocolState>) => {
    console.log("DEBUG: updateState called with:", updates);
    setState(prev => {
      let next = { ...prev, ...updates };
      console.log("DEBUG: updateState resulting next state:", next);
      
      // Local reactive triggers for calculator
      const zAlpha = Math.abs(normSInv(next.sampleSizeParams.alpha / 2));
      const zBeta = normSInv(next.sampleSizeParams.power);
      if (next.sampleSizeParams.effectSize > 0) {
        const nPerArm = Math.ceil((2 * Math.pow(zAlpha + zBeta, 2)) / Math.pow(next.sampleSizeParams.effectSize, 2));
        next.sampleSizeResult = { perArm: nPerArm, total: nPerArm + Math.ceil(nPerArm * next.sampleSizeParams.ratio) };
      }

      return next;
    });
  };

  const saveVersion = () => {
    const v = { id: `v${versions.length + 1}`, timestamp: new Date().toISOString(), state };
    setVersions([v, ...versions]);
  };

  const isStepCompleted = (i: number) => {
    switch (i) {
      case 0: return !!state.researchQuestion;
      case 1: return !!state.handoffData;
      case 2: return !!(state.pico.population && state.pico.intervention && state.pico.outcome);
      case 3: return !!state.hypothesis.primary;
      case 4: return state.studyType.recommended !== "";
      case 5: return state.sampleSizeResult.total > 0;
      case 6: return state.statisticalPlan.recommendedTest !== "";
      case 7: return state.criteria.inclusion.length > 0 || state.criteria.exclusion.length > 0;
      case 8: return state.confounders.length > 0;
      case 9: return !!state.ayurveda.formulation;
      case 10: return state.timeline.length > 0;
      case 11: return state.ethics.some(e => e.checked);
      case 12: return false;
      default: return false;
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      
      {/* PANE 1: NAVIGATION & WORKFLOW */}
      <div className="w-64 flex flex-col border-r border-border-light bg-surface shadow-sm z-20 flex-shrink-0">
        <div className="p-4 border-b border-border-light bg-surface flex items-center gap-2 text-accent font-black">
          <Microscope size={20} /> AI Study Architect
        </div>
        
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-1">
          {STEPS.map((step, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`text-left px-3 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-between group
                ${activeStep === i ? "bg-accent text-white shadow-sm" : 
                  isStepCompleted(i) ? "text-slate-700 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <div className="flex items-center gap-2">
                {activeStep === i ? (
                  <Edit3 size={14} className="opacity-70" />
                ) : isStepCompleted(i) ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <Circle size={14} className="opacity-40" />
                )}
                {step.label}
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-border-light bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><History size={12}/> Versions</span>
            <button onClick={saveVersion} className="text-xs text-accent hover:underline font-bold flex items-center gap-1"><Save size={12}/> Snapshot</button>
          </div>
          <div className="flex flex-col gap-2 max-h-32 overflow-auto">
            {versions.length === 0 ? (
              <div className="text-xs text-slate-400 italic">No snapshots saved.</div>
            ) : (
              versions.map(v => (
                <div key={v.id} className="text-xs bg-white border border-slate-200 p-2 rounded flex justify-between items-center cursor-pointer hover:border-accent" onClick={() => { if(confirm("Restore this version?")) setState(v.state); }}>
                  <span className="font-semibold text-slate-700">{v.id}</span>
                  <span className="text-slate-400">{new Date(v.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PANE 2: ACTIVE WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-auto bg-slate-50/50 relative">
        <div className="p-6 max-w-3xl mx-auto w-full flex flex-col gap-6 flex-1">
          {/* Enhanced Header with Title Renamer and Save status badges */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
            <div className="flex-1 mr-4">
              <input
                type="text"
                className="text-xl font-bold bg-transparent border-none text-slate-800 w-full focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1"
                value={state.title || "Untitled Study Protocol"}
                onChange={e => updateState({ title: e.target.value })}
                placeholder="Untitled Study Protocol"
              />
              <p className="text-xs text-slate-500 mt-1">Step {activeStep + 1} of {STEPS.length}: {STEPS[activeStep].label}</p>
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
              {intelligenceMode === "ai" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  AI-enhanced analysis
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Running client-side offline engines.">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Offline fallback
                </span>
              )}
              
              {saveStatus === "saving" && <span className="text-xs text-slate-400 italic">Saving...</span>}
              {saveStatus === "saved" && <span className="text-xs text-slate-400">Autosaved</span>}
              {saveStatus === "offline" && <span className="text-xs text-amber-500">Local Cache</span>}
            </div>
          </div>

          {/* Render Step Components */}
          {activeStep === 0 && <StepResearchQuestion state={state} updateState={updateState} />}
          {activeStep === 1 && <StepEvidenceHandoff state={state} updateState={updateState} />}
          {activeStep === 2 && <StepPicoBuilder state={state} updateState={updateState} />}
          {activeStep === 3 && <StepHypothesisFormalizer state={state} updateState={updateState} />}
          {activeStep === 4 && <StepStudyType state={state} updateState={updateState} />}
          {activeStep === 5 && <StepSampleSize state={state} updateState={updateState} />}
          {activeStep === 6 && <StepStatisticalPlan state={state} updateState={updateState} />}
          {activeStep === 7 && <StepCriteria state={state} updateState={updateState} />}
          {activeStep === 8 && <StepConfounders state={state} updateState={updateState} />}
          {activeStep === 9 && <StepAyurveda state={state} updateState={updateState} />}
          {activeStep === 10 && <StepTimeline state={state} updateState={updateState} />}
          {activeStep === 11 && <StepEthics state={state} updateState={updateState} />}
          {activeStep === 12 && <StepExport state={state} />}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <Button variant="outline" onClick={() => setActiveStep(p => Math.max(0, p-1))} disabled={activeStep === 0}>Back</Button>
          <Button className="bg-accent text-white" onClick={() => setActiveStep(p => Math.min(STEPS.length-1, p+1))}>{activeStep === STEPS.length-1 ? "Finish" : "Next"}</Button>
        </div>
      </div>

      {/* PANE 3: AUDIT & INTELLIGENCE DASHBOARD / LIVE PREVIEW */}
      <div className="w-[400px] flex flex-col border-l border-border-light bg-surface shadow-xl z-20 flex-shrink-0">
        <div className="flex border-b border-border-light flex-shrink-0">
          <button className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 ${rightPaneView === 'intelligence' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setRightPaneView('intelligence')}>
            <Brain size={14} /> Audit
          </button>
          <button className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 ${rightPaneView === 'document' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setRightPaneView('document')}>
            <FileText size={14} /> Protocol
          </button>
          <button className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 ${rightPaneView === 'reviewer' ? 'text-emerald-700 border-b-2 border-emerald-700 bg-emerald-50/50' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setRightPaneView('reviewer')}>
            <ShieldAlert size={14} /> Review
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50">
          {rightPaneView === 'intelligence' && <IntelligenceDashboard state={state} setActiveStep={setActiveStep} loading={loadingIntelligence} />}
          {rightPaneView === 'document' && <LivePreview state={state} />}
          {rightPaneView === 'reviewer' && <ReviewerFeedbackPanel state={state} />}
        </div>
      </div>

    </div>
  );
}

// --- STEP COMPONENTS ---

interface StepProps { state: ProtocolState; updateState: (updates: Partial<ProtocolState>) => void; }

function StepResearchQuestion({ state, updateState }: StepProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleFetchAndFill = async () => {
    if (!state.researchQuestion) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const handoff = await fetchLiveBrahmaEvidenceHandoff(state.researchQuestion, 30);
      console.log("DEBUG: fetchLiveBrahmaEvidenceHandoff returned handoff:", handoff);
      const pico = (handoff as any).pico_suggestion || {};
      const ayurveda = (handoff as any).ayurveda_suggestion || {};
      console.log("DEBUG: Extracted pico:", pico, "ayurveda:", ayurveda);
      updateState({
        title: (handoff as any).title_suggestion || state.title || "Live Evidence Study Protocol",
        handoffData: handoff,
        pico: {
          population: pico.population || state.pico.population,
          intervention: pico.intervention || state.pico.intervention,
          comparator: pico.comparator || state.pico.comparator,
          outcome: pico.outcome || state.pico.outcome,
        },
        ayurveda: {
          ...state.ayurveda,
          ...ayurveda,
        },
      });
      localStorage.setItem("brahma_handoff_collection", JSON.stringify(handoff));
      setSuccess(true);
    } catch (e: any) {
      console.error("DEBUG: fetchAndFill failed with error:", e);
      setError(e.message || "Failed to search evidence and extract parameters.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 leading-relaxed">
        <strong className="text-blue-700">Tip:</strong> Type your clinical or biological research question below. You can search the evidence database and extract PICO parameters immediately from here.
      </div>
      
      <textarea 
        className="w-full h-40 p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none shadow-sm" 
        placeholder="e.g. Does Ashwagandha reduce cortisol levels in adults with chronic stress compared to placebo?" 
        value={state.researchQuestion} 
        onChange={e => {
          updateState({ researchQuestion: e.target.value });
          setSuccess(false);
        }} 
      />

      <div className="flex flex-col gap-3">
        <Button 
          onClick={handleFetchAndFill} 
          disabled={loading || !state.researchQuestion}
          className="bg-accent text-white hover:bg-accent/90 flex items-center justify-center gap-2 h-11 text-sm font-bold shadow-md shadow-accent/20"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database size={16} />}
          {loading ? "Searching & Extracting PICO..." : "Analyze Question & Search Evidence"}
        </Button>
        
        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
            <CheckCircle2 size={14} className="flex-shrink-0" />
            <span>Success! Found clinical evidence and populated PICO parameters automatically. Proceed to the next steps.</span>
          </div>
        )}
        
        {error && (
          <div className="text-xs text-danger bg-danger/10 p-3 rounded-lg border border-danger/20">
            {error}
          </div>
        )}
        
        {state.researchQuestion && !success && !loading && (
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
            <CheckCircle2 size={14} className="flex-shrink-0" />
            Research question captured. Click above to auto-fill PICO, or proceed to handle manually.
          </div>
        )}
      </div>
    </div>
  );
}

function StepEvidenceHandoff({ state, updateState }: StepProps) {
  const data: HandoffPayload | null = state.handoffData;
  const [validation, setValidation] = React.useState<any>(null);
  const [validating, setValidating] = React.useState(false);
  const [query, setQuery] = React.useState((data as any)?.query || state.researchQuestion || "");
  const [limit, setLimit] = React.useState(30);
  const [loadingLive, setLoadingLive] = React.useState(false);
  const [liveError, setLiveError] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    setValidating(true);
    validateEvidenceHandoff(data as any)
      .then(setValidation)
      .catch(() => setValidation(null))
      .finally(() => setValidating(false));
  }, [data?.collection_id]);

  // Always keep query in sync with research question (unless user manually changed it after a fetch)
  React.useEffect(() => {
    if (state.researchQuestion) {
      setQuery(state.researchQuestion);
    }
  }, [state.researchQuestion]);


  const applyHandoff = (handoff: HandoffPayload) => {
    const pico = (handoff as any).pico_suggestion || {};
    const ayurveda = (handoff as any).ayurveda_suggestion || {};
    updateState({
      title: (handoff as any).title_suggestion || state.title || "Live Evidence Study Protocol",
      researchQuestion: handoff.hypothesis_seed || state.researchQuestion,
      handoffData: handoff,
      pico: {
        population: pico.population || state.pico.population,
        intervention: pico.intervention || state.pico.intervention,
        comparator: pico.comparator || state.pico.comparator,
        outcome: pico.outcome || state.pico.outcome,
      },
      ayurveda: {
        ...state.ayurveda,
        ...ayurveda,
      },
    });
    localStorage.setItem("brahma_handoff_collection", JSON.stringify(handoff));
  };

  const loadLiveEvidence = async () => {
    setLoadingLive(true);
    setLiveError("");
    try {
      const handoff = await fetchLiveBrahmaEvidenceHandoff(query, limit);
      applyHandoff(handoff);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Unable to load live papers from the database.");
    } finally {
      setLoadingLive(false);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in">
        <Card className="border-primary/20 bg-primary/5 p-6">
          <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2"><Database size={16} /> Fetch Evidence from Database</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Search Query</label>
              <input 
                className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white" 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                placeholder="Enter research topic or intervention..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Number of Papers</label>
              <select 
                className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white"
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
              >
                <option value={10}>10 papers</option>
                <option value={30}>30 papers</option>
                <option value={50}>50 papers</option>
                <option value={100}>100 papers</option>
              </select>
            </div>
            <Button 
              onClick={loadLiveEvidence} 
              disabled={loadingLive || !query}
              className="w-full bg-primary text-white"
            >
              {loadingLive ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              {loadingLive ? "Fetching..." : "Fetch Evidence"}
            </Button>
            {liveError && <div className="text-xs text-danger bg-danger/10 p-2 rounded">{liveError}</div>}
          </div>
        </Card>
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center text-center bg-white">
          <Database size={36} className="text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-700">Or Use RISHI Evidence Handoff</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Navigate to <strong>Library / RECAP</strong> and click <em>Design Study in BRAHMA</em> on any collection to pre-fill this protocol with evidence.
          </p>
          <p className="text-[10px] text-slate-300 mt-4 italic">You can still create a protocol manually — evidence handoff is optional.</p>
        </div>
      </div>
    );
  }

  const sources = data.sources || [];
  const gaps = data.gaps || [];

  const clearHandoff = () => {
    updateState({ handoffData: null });
    localStorage.removeItem("brahma_handoff_collection");
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in">
      {/* Adapter badge */}
      <Card className="border-success/30 bg-emerald-50/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-success font-bold text-sm">
            <CheckCircle2 size={16} /> Evidence Handoff from RISHI Adapter
          </div>
          <button 
            onClick={clearHandoff}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline bg-red-50 border border-red-200 rounded px-2.5 py-1"
          >
            Clear & Re-fetch
          </button>
          {validating ? (
            <Badge color="warning">Validating...</Badge>
          ) : validation?.ready_for_brahma ? (
            <Badge color="success">✓ Validated — {validation.paper_count} sources, {validation.high_quality_sources} high-quality</Badge>
          ) : validation && !validation.ready_for_brahma ? (
            <Badge color="danger">Validation Issues</Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Collection ID</span>
            <span className="font-mono">{data.collection_id}</span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Query Used</span>
            <span className="truncate block">{(data as any).query || "RISHI discovery pipeline"}</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 mt-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">RISHI Hypothesis Seed</span>
          <p className="text-sm italic text-slate-700 leading-snug">{data.hypothesis_seed}</p>
        </div>
        {(data as any).summary && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Evidence Summary</span>
            <p className="text-xs text-slate-600">{(data as any).summary}</p>
          </div>
        )}
      </Card>

      {/* Research Gaps */}
      {gaps.length > 0 && (
        <div>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Research Gaps ({gaps.length})</h3>
          <div className="flex flex-col gap-1.5">
            {gaps.map((gap: string, i: number) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">{gap}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      <div>
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Linked Evidence Sources ({sources.length})</h3>
        <div className="flex flex-col gap-2">
          {sources.map((src: any, idx: number) => (
            <div key={idx} className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-start gap-3">
                <h4 className="text-xs font-bold text-slate-800 leading-snug">{src.title}</h4>
                <Badge color={src.evidenceLevel === "High" ? "success" : "primary"} className="flex-shrink-0 text-[9px]">
                  {src.evidenceLevel}
                </Badge>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{src.authors} • {src.year}{src.journal ? ` • ${src.journal}` : ""}</p>
              {src.doi && <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1 py-0.5 rounded mt-1 inline-block">DOI: {src.doi}</span>}
              {src.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {src.tags.map((tag: string) => (
                    <span key={tag} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPicoBuilder({ state, updateState }: StepProps) {
  const h = (f: keyof ProtocolState['pico'], v: string) => updateState({ pico: { ...state.pico, [f]: v } });
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <Card className="border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 mb-2 text-primary font-bold text-sm"><Users size={16} /> Population</div><input className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg shadow-sm" value={state.pico.population} onChange={e => h("population", e.target.value)} /></Card>
      <Card className="border-success/20 bg-success/5 p-4"><div className="flex items-center gap-2 mb-2 text-success font-bold text-sm"><Activity size={16} /> Intervention</div><input className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg shadow-sm" value={state.pico.intervention} onChange={e => h("intervention", e.target.value)} /></Card>
      <Card className="border-warning/20 bg-warning/5 p-4"><div className="flex items-center gap-2 mb-2 text-warning font-bold text-sm"><HelpCircle size={16} /> Comparator (Optional)</div><input className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg shadow-sm" value={state.pico.comparator} onChange={e => h("comparator", e.target.value)} /></Card>
      <Card className="border-accent/20 bg-accent/5 p-4"><div className="flex items-center gap-2 mb-2 text-accent font-bold text-sm"><Target size={16} /> Outcome</div><input className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg shadow-sm" value={state.pico.outcome} onChange={e => h("outcome", e.target.value)} /></Card>
    </div>
  );
}

function AIExplanation({ meta }: { meta?: { value: string, confidence: number, reasoning: string, improvements: string[] } }) {
  if (!meta) return null;
  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mt-4 shadow-inner">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 text-primary font-bold text-sm"><Brain size={16} /> AI Architect Reasoning</div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${meta.confidence >= 90 ? 'bg-success/20 text-success' : meta.confidence >= 70 ? 'bg-warning/20 text-warning-dark' : 'bg-danger/20 text-danger'}`}>{meta.confidence}% Confidence</div>
      </div>
      <p className="text-xs text-slate-700 mb-3 leading-relaxed">{meta.reasoning}</p>
      {meta.improvements.length > 0 && (
        <div className="bg-white/60 p-3 rounded text-[11px] text-slate-600 border border-blue-100">
          <strong className="block mb-1 text-slate-700">Actionable Improvements:</strong>
          <ul className="list-disc list-inside space-y-1">{meta.improvements.map((imp, idx) => <li key={idx}>{imp}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function StepHypothesisFormalizer({ state, updateState }: StepProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">AI Auto-Formalization</span>
        <Button size="sm" variant={state.hypothesis.isAuto ? "outline" : "primary"} onClick={() => updateState({ hypothesis: { ...state.hypothesis, isAuto: !state.hypothesis.isAuto } })}>
          {state.hypothesis.isAuto ? "Unlock for Manual Editing" : "Switch to Auto-Generate"}
        </Button>
      </div>
      
      <Card className="border-l-4 border-l-accent shadow-sm">
        <div className="space-y-4">
          <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Primary Objective</label><textarea className="w-full text-sm bg-slate-50 p-3 rounded border border-slate-200 resize-none h-16" disabled={state.hypothesis.isAuto} value={state.hypothesis.primaryObjective} onChange={e => updateState({ hypothesis: { ...state.hypothesis, primaryObjective: e.target.value }})} /></div>
          <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Primary Hypothesis (H1)</label><textarea className="w-full text-sm bg-slate-50 p-3 rounded border border-slate-200 resize-none h-20" disabled={state.hypothesis.isAuto} value={state.hypothesis.primary} onChange={e => updateState({ hypothesis: { ...state.hypothesis, primary: e.target.value }})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Null Hypothesis (H0)</label><textarea className="w-full h-24 text-xs bg-slate-50 p-3 rounded border border-slate-200 resize-none" disabled={state.hypothesis.isAuto} value={state.hypothesis.nullHypothesis} onChange={e => updateState({ hypothesis: { ...state.hypothesis, nullHypothesis: e.target.value }})} /></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Alternative Hypothesis</label><textarea className="w-full h-24 text-xs bg-slate-50 p-3 rounded border border-slate-200 resize-none" disabled={state.hypothesis.isAuto} value={state.hypothesis.alternative} onChange={e => updateState({ hypothesis: { ...state.hypothesis, alternative: e.target.value }})} /></div>
          </div>
        </div>
      </Card>
      
      {state.hypothesis.isAuto && <AIExplanation meta={state.hypothesis.aiMetadata} />}
    </div>
  );
}

function StepStudyType({ state }: StepProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <Card className="border-accent/30 bg-white shadow-lg flex flex-col items-center justify-center p-8 text-center">
        <ShieldAlert size={48} className="text-accent mb-4 opacity-80" />
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Architect Recommendation</h3>
        <div className="text-3xl font-black text-slate-800">{state.studyType.recommended}</div>
      </Card>
      <AIExplanation meta={state.studyType.aiMetadata} />
    </div>
  );
}

function StepSampleSize({ state, updateState }: StepProps) {
  const h = (f: keyof ProtocolState['sampleSizeParams'], v: number) => updateState({ sampleSizeParams: { ...state.sampleSizeParams, [f]: v } });
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <div className="bg-slate-900 text-white rounded-xl p-8 flex items-center justify-between shadow-lg">
        <div><div className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Total Participants (N)</div><div className="text-6xl font-black">{state.sampleSizeResult.total || 0}</div></div>
        {state.sampleSizeResult.total > 0 && <div className="text-right"><div className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Per Arm</div><div className="text-4xl font-bold text-accent">{state.sampleSizeResult.perArm}</div></div>}
      </div>
      <Card className="space-y-6 bg-white p-6 shadow-sm">
        <div><div className="flex justify-between text-sm mb-2"><span className="font-bold text-slate-700">Statistical Power (1-β)</span><span className="font-black text-accent">{Math.round(state.sampleSizeParams.power * 100)}%</span></div><input type="range" className="w-full accent-accent" min="0.70" max="0.99" step="0.01" value={state.sampleSizeParams.power} onChange={e => h("power", parseFloat(e.target.value))} /></div>
        <div><div className="flex justify-between text-sm mb-2"><span className="font-bold text-slate-700">Alpha (α) / Significance Level</span><span className="font-black text-accent">{state.sampleSizeParams.alpha}</span></div><input type="range" className="w-full accent-accent" min="0.01" max="0.10" step="0.01" value={state.sampleSizeParams.alpha} onChange={e => h("alpha", parseFloat(e.target.value))} /></div>
        <div><div className="flex justify-between text-sm mb-2"><span className="font-bold text-slate-700">Expected Effect Size (Cohen's d)</span><span className="font-black text-accent">{state.sampleSizeParams.effectSize}</span></div><input type="range" className="w-full accent-accent" min="0.1" max="1.5" step="0.1" value={state.sampleSizeParams.effectSize} onChange={e => h("effectSize", parseFloat(e.target.value))} /></div>
      </Card>
    </div>
  );
}

function StepStatisticalPlan({ state, updateState }: StepProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <Card className="bg-white shadow-sm space-y-4 p-6">
        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Primary Statistical Test (AI Rec)</label><div className="p-3 border border-accent/30 rounded-lg bg-accent/5 text-sm font-bold text-slate-800">{state.statisticalPlan.recommendedTest}</div></div>
        <AIExplanation meta={state.statisticalPlan.aiMetadata} />
        <div className="pt-4 border-t border-slate-100"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Regression & Adjustment Plan</label><input className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" value={state.statisticalPlan.regression} onChange={e => updateState({ statisticalPlan: { ...state.statisticalPlan, regression: e.target.value }})} /></div>
        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Missing Data Handling</label><select className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 text-sm" value={state.statisticalPlan.missingData} onChange={e => updateState({ statisticalPlan: { ...state.statisticalPlan, missingData: e.target.value }})}><option>Multiple Imputation (MAR)</option><option>LOCF</option><option>Complete Case Analysis</option></select></div>
      </Card>
    </div>
  );
}

function StepCriteria({ state, updateState }: StepProps) {
  const [loading, setLoading] = React.useState(false);

  const loadCriteria = async () => {
    setLoading(true);
    try {
      const rec = await suggestCriteriaAPI(state.pico.population, state.pico.intervention);
      updateState({ criteria: {
        inclusion: (rec.inclusion || []).map((t: any, i: number) => ({ 
          id: `inc-${i}`, 
          text: typeof t === 'object' && t !== null ? (t.description || t.name || JSON.stringify(t)) : String(t) 
        })),
        exclusion: (rec.exclusion || []).map((t: any, i: number) => ({ 
          id: `exc-${i}`, 
          text: typeof t === 'object' && t !== null ? (t.description || t.name || JSON.stringify(t)) : String(t) 
        }))
      }});
    } catch (e) {
      console.error('Failed to load criteria:', e);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    if (state.criteria.inclusion.length === 0 && state.criteria.exclusion.length === 0) {
      if (state.pico.population && state.pico.intervention) {
        loadCriteria();
      }
    }
  }, [state.pico.population, state.pico.intervention]);

  const add = (type: 'inclusion'|'exclusion') => {
    const t = window.prompt(`Enter new ${type} criteria:`);
    if (t) updateState({ criteria: { ...state.criteria, [type]: [...state.criteria[type], { id: Date.now().toString(), text: t }] } });
  };
  const rm = (type: 'inclusion'|'exclusion', id: string) => updateState({ criteria: { ...state.criteria, [type]: state.criteria[type].filter(c => c.id !== id) } });

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">AI Eligibility Criteria</span>
        <Button size="sm" onClick={loadCriteria} disabled={loading || !state.pico.population}>
          {loading ? "Generating..." : "Auto-Suggest Criteria"}
        </Button>
      </div>
      <Card className="border-success/30 bg-success/5"><h4 className="text-sm font-black text-success-dark uppercase tracking-wider mb-3 px-2">Inclusion Criteria</h4><ul className="flex flex-col gap-2">{state.criteria.inclusion.map(c => <li key={c.id} className="text-sm flex justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm"><span className="text-slate-700">• {c.text}</span><button onClick={()=>rm('inclusion', c.id)} className="text-slate-400 hover:text-danger"><X size={16}/></button></li>)}<li onClick={()=>add('inclusion')} className="text-sm text-slate-500 flex items-center justify-center gap-2 p-3 cursor-pointer border-2 border-dashed border-success/30 bg-white hover:bg-success/5 rounded-lg font-bold transition-colors"><Plus size={16}/> Add Inclusion</li></ul></Card>
      <Card className="border-danger/30 bg-danger/5"><h4 className="text-sm font-black text-danger-dark uppercase tracking-wider mb-3 px-2">Exclusion Criteria</h4><ul className="flex flex-col gap-2">{state.criteria.exclusion.map(c => <li key={c.id} className="text-sm flex justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm"><span className="text-slate-700">× {c.text}</span><button onClick={()=>rm('exclusion', c.id)} className="text-slate-400 hover:text-danger"><X size={16}/></button></li>)}<li onClick={()=>add('exclusion')} className="text-sm text-slate-500 flex items-center justify-center gap-2 p-3 cursor-pointer border-2 border-dashed border-danger/30 bg-white hover:bg-danger/5 rounded-lg font-bold transition-colors"><Plus size={16}/> Add Exclusion</li></ul></Card>
    </div>
  );
}

function StepConfounders({ state, updateState }: StepProps) {
  const [loading, setLoading] = React.useState(false);

  const loadConfounders = async () => {
    setLoading(true);
    try {
      const rec = await suggestConfoundersAPI(state.pico.population, state.pico.intervention);
      updateState({ confounders: rec.confounders });
    } catch (e) {
      console.error('Failed to load confounders:', e);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    if (state.confounders.length === 0) {
      if (state.pico.population && state.pico.intervention) {
        loadConfounders();
      }
    }
  }, [state.pico.population, state.pico.intervention]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">AI Confounder Analysis</span>
        <Button size="sm" onClick={loadConfounders} disabled={loading || !state.pico.population}>
          {loading ? "Analyzing..." : "Identify Confounders"}
        </Button>
      </div>
      {state.confounders.map(c => (
        <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className={`absolute top-0 right-0 ${c.risk === 'High' ? 'bg-danger text-white' : 'bg-warning text-warning-dark'} text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl`}>{c.risk} Risk</div>
          <h4 className="font-bold text-slate-800 mb-2 mt-1">{c.name}</h4>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600"><strong className="text-slate-800">Mitigation:</strong> {c.mitigation}</div>
        </div>
      ))}
      <Button variant="outline" className="w-full border-dashed border-2 py-6 text-slate-500 hover:text-primary hover:border-primary"><Plus size={18} className="mr-2" /> Add Confounding Variable</Button>
    </div>
  );
}

function StepAyurveda({ state, updateState }: StepProps) {
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!state.pico.intervention) return;
    const loadAyurveda = async () => {
      setLoading(true);
      try {
        const rec = await suggestAyurvedaProtocolAPI(state.pico.intervention);
        updateState({
          ayurveda: {
            ...rec.protocol,
            targets: rec.targets || [],
            correlationPaths: rec.correlationPaths || [],
            source: rec.aiMetadata?.neo4jSource || ""
          }
        });
      } catch (e) {
        console.error('Failed to load Ayurveda protocol:', e);
      }
      setLoading(false);
    };
    loadAyurveda();
  }, [state.pico.intervention]);

  const h = (f: keyof ProtocolState['ayurveda'], v: string) => updateState({ ayurveda: { ...state.ayurveda, [f]: v } });
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <Card className="bg-emerald-50/30 border-emerald-200/50 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Formulation / Intervention</label><input className="w-full p-3 border border-emerald-100 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. Ashwagandha Churna" value={state.ayurveda.formulation} onChange={e => h("formulation", e.target.value)} /></div>
          <div><label className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Dosage Schedule</label><input className="w-full p-3 border border-emerald-100 rounded-lg text-sm bg-white" placeholder="e.g. 5g twice daily" value={state.ayurveda.dosage} onChange={e => h("dosage", e.target.value)} /></div>
          <div><label className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Anupana (Vehicle)</label><input className="w-full p-3 border border-emerald-100 rounded-lg text-sm bg-white" value={state.ayurveda.anupana} onChange={e => h("anupana", e.target.value)} /></div>
          <div><label className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Target Prakriti</label><input className="w-full p-3 border border-emerald-100 rounded-lg text-sm bg-white" value={state.ayurveda.prakriti} onChange={e => h("prakriti", e.target.value)} /></div>
        </div>
        <div className="pt-2"><label className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Standardization / QC Notes (API)</label><input className="w-full p-3 border border-emerald-100 rounded-lg text-sm bg-white" value={state.ayurveda.standardization} onChange={e => h("standardization", e.target.value)} /></div>
        <div><label className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Safety & Monitoring Plan</label><input className="w-full p-3 border border-emerald-100 rounded-lg text-sm bg-white" value={state.ayurveda.safety} onChange={e => h("safety", e.target.value)} /></div>
      </Card>
      
      {state.ayurveda.targets && state.ayurveda.targets.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100 p-6 space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-emerald-400">
              <Microscope size={16} /> Bio-Molecular Targets & Paths
            </h4>
            {state.ayurveda.source && (
              <Badge className="bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-mono text-[10px]">
                Source: {state.ayurveda.source}
              </Badge>
            )}
          </div>
          
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Suggested Target Candidates</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {state.ayurveda.targets.map((t, idx) => (
                <span key={idx} className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs font-black rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          
          {state.ayurveda.correlationPaths && state.ayurveda.correlationPaths.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Bio-Entity Mapping Paths</span>
              <div className="space-y-2.5">
                {state.ayurveda.correlationPaths.map((p, idx) => {
                  const parts = p.split(/ -\[(.*?)\]-> /);
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
                      {parts.map((part, pIdx) => {
                        const isRel = pIdx % 2 === 1;
                        if (isRel) {
                          return (
                            <span key={pIdx} className="text-emerald-400 font-semibold bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/30">
                              → {part} →
                            </span>
                          );
                        } else {
                          return (
                            <span key={pIdx} className="text-slate-200 font-black">
                              {part}
                            </span>
                          );
                        }
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function StepTimeline({ state, updateState }: StepProps) {
  const [loading, setLoading] = React.useState(false);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const rec = await suggestTimelineAPI(
        state.studyType.recommended, 
        12, 
        state.researchQuestion, 
        state.pico
      );
      updateState({ timeline: rec.timeline });
    } catch (e) {
      console.error('Failed to load timeline:', e);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    if (state.timeline.length === 0) {
      if (state.studyType.recommended) {
        loadTimeline();
      }
    }
  }, [state.studyType.recommended]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in py-8 px-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm mb-4">
        <span className="text-sm font-semibold text-slate-700">AI Timeline Builder</span>
        <Button size="sm" onClick={loadTimeline} disabled={loading || !state.studyType.recommended}>
          {loading ? "Generating..." : "Generate Timeline"}
        </Button>
      </div>
      <div className="relative border-l-2 border-slate-200 ml-4 space-y-8">
        {state.timeline.map((t) => (
          <div key={t.id} className="relative pl-8">
            <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white ${(t.color || 'text-primary').replace('text', 'bg')} shadow-sm`} />
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="font-black text-slate-800">{t.label}</div>
              <div className="text-sm font-semibold text-slate-500 mt-1">{t.duration}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepEthics({ state, updateState }: StepProps) {
  const toggle = (id: string) => updateState({ ethics: state.ethics.map(e => e.id === id ? { ...e, checked: !e.checked } : e) });
  return (
    <div className="flex flex-col gap-2 animate-in fade-in">
      {state.ethics.map(e => (
        <div key={e.id} onClick={() => toggle(e.id)} className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${e.checked ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200 shadow-sm hover:border-accent"}`}>
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${e.checked ? "bg-accent border-accent text-white" : "border-slate-300"}`}>{e.checked && <CheckSquare size={14}/>}</div>
          <span className={`text-sm font-semibold ${e.checked ? "text-slate-400 line-through" : "text-slate-700"}`}>{e.label}</span>
        </div>
      ))}
    </div>
  );
}

function StepExport({ state }: { state: ProtocolState }) {
  const [exporting, setExporting] = useState<string | null>(null);

  const getExportPayload = () => ({
    title: state.title || "Untitled Study Protocol",
    research_question: state.researchQuestion,
    pico: state.pico,
    hypothesis: state.hypothesis,
    study_type: state.studyType,
    sample_size: state.sampleSizeParams,
    sample_size_result: state.sampleSizeResult,
    statistical_plan: state.statisticalPlan,
    eligibility: state.criteria,
    confounders: state.confounders,
    ayurveda: state.ayurveda,
    timeline: state.timeline,
    ethics: state.ethics,
    intelligence: state.intelligence
  });

  const handleCopyMarkdown = async () => {
    setExporting("markdown");
    try {
      const res = await exportProtocolAPI(getExportPayload(), "markdown");
      await navigator.clipboard.writeText(res.content);
      alert("Professional Markdown protocol copied to clipboard!");
    } catch (e) {
      alert("Failed to export via backend AI. Fallback Markdown copying...");
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadDocx = async () => {
    setExporting("docx");
    try {
      const blob = await exportProtocolDocxAPI(getExportPayload());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.title || "protocol_report"}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export Word Document (.docx) via backend AI.");
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadHTML = () => {
    setExporting("html");
    try {
      const s = state;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${s.title || 'Study Protocol'}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 820px; margin: 40px auto; color: #1e293b; line-height: 1.7; }
    h1 { font-size: 22px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 28px; }
    .meta { color: #94a3b8; font-size: 12px; margin-bottom: 24px; }
    .pico-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
    .pico-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .pico-label { font-size: 11px; font-weight: bold; color: #3b82f6; text-transform: uppercase; }
    .hyp-box { background: #f1f5f9; border-left: 3px solid #6366f1; padding: 12px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-medium { background: #fef3c7; color: #d97706; }
    .badge-low { background: #dcfce7; color: #16a34a; }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td, th { border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 13px; }
    th { background: #f8fafc; font-weight: bold; }
    .timeline-item { display: flex; gap: 16px; margin: 8px 0; }
    .timeline-dot { width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
    .score { font-size: 48px; font-weight: 900; color: ${s.intelligence?.qualityScore >= 85 ? '#16a34a' : s.intelligence?.qualityScore >= 60 ? '#d97706' : '#dc2626'}; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${s.title || 'Study Protocol'}</h1>
  <p class="meta">Protocol ID: BRH-${new Date().getFullYear()}-${String(s.intelligence?.qualityScore || 0).padStart(4,'0')} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>

  <h2>1. Background &amp; Research Question</h2>
  <p>${s.researchQuestion || '<em>Not specified</em>'}</p>

  <h2>2. PICO Framework</h2>
  <div class="pico-grid">
    <div class="pico-item"><div class="pico-label">Population</div>${s.pico?.population || '—'}</div>
    <div class="pico-item"><div class="pico-label">Intervention</div>${s.pico?.intervention || '—'}</div>
    <div class="pico-item"><div class="pico-label">Comparator</div>${s.pico?.comparator || 'None'}</div>
    <div class="pico-item"><div class="pico-label">Outcome</div>${s.pico?.outcome || '—'}</div>
  </div>

  <h2>3. Hypotheses</h2>
  <div class="hyp-box"><strong>H1:</strong> ${s.hypothesis?.primary || '—'}</div>
  <div class="hyp-box"><strong>H0:</strong> ${s.hypothesis?.nullHypothesis || '—'}</div>
  <p><strong>Primary Objective:</strong> ${s.hypothesis?.primaryObjective || '—'}</p>

  <h2>4. Study Design</h2>
  <p><strong>Architecture:</strong> ${s.studyType?.recommended || '—'}</p>

  <h2>5. Sample Size</h2>
  <table>
    <tr><th>Parameter</th><th>Value</th></tr>
    <tr><td>Total Participants (N)</td><td><strong>${s.sampleSizeResult?.total || 0}</strong></td></tr>
    <tr><td>Per Arm</td><td>${s.sampleSizeResult?.perArm || 0}</td></tr>
    <tr><td>Statistical Power (1-β)</td><td>${Math.round((s.sampleSizeParams?.power || 0.8) * 100)}%</td></tr>
    <tr><td>Alpha (α)</td><td>${s.sampleSizeParams?.alpha || 0.05}</td></tr>
    <tr><td>Effect Size (Cohen's d)</td><td>${s.sampleSizeParams?.effectSize || 0.5}</td></tr>
  </table>

  <h2>6. Statistical Analysis Plan</h2>
  <p><strong>Primary Test:</strong> ${s.statisticalPlan?.recommendedTest || '—'}</p>
  <p><strong>Regression:</strong> ${s.statisticalPlan?.regression || '—'}</p>
  <p><strong>Missing Data:</strong> ${s.statisticalPlan?.missingData || '—'}</p>

  <h2>7. Eligibility Criteria</h2>
  <p><strong>Inclusion:</strong></p>
  <ul>${(s.criteria?.inclusion || []).map((c: any) => `<li>${c.text}</li>`).join('')}</ul>
  <p><strong>Exclusion:</strong></p>
  <ul>${(s.criteria?.exclusion || []).map((c: any) => `<li>${c.text}</li>`).join('')}</ul>

  <h2>8. Confounders</h2>
  <ul>${(s.confounders || []).map((c: any) => `<li><span class="badge badge-${c.risk?.toLowerCase()}">${c.risk} Risk</span> <strong>${c.name}</strong>: ${c.mitigation}</li>`).join('') || '<li>None identified</li>'}</ul>

  <h2>9. AYUSH Protocol</h2>
  <table>
    <tr><th>Parameter</th><th>Value</th></tr>
    <tr><td>Formulation</td><td>${s.ayurveda?.formulation || '—'}</td></tr>
    <tr><td>Dosage</td><td>${s.ayurveda?.dosage || '—'}</td></tr>
    <tr><td>Anupana</td><td>${s.ayurveda?.anupana || '—'}</td></tr>
    <tr><td>Prakriti</td><td>${s.ayurveda?.prakriti || '—'}</td></tr>
    <tr><td>Duration</td><td>${s.ayurveda?.duration || '—'}</td></tr>
    <tr><td>Safety Monitoring</td><td>${s.ayurveda?.safety || '—'}</td></tr>
  </table>

  <h2>10. Study Timeline</h2>
  ${(s.timeline || []).map((t: any) => `<div class="timeline-item"><div class="timeline-dot"></div><div><strong>${t.label}</strong> — ${t.duration}</div></div>`).join('')}

  <h2>11. Ethics &amp; Compliance</h2>
  <ul>${(s.ethics || []).map((e: any) => `<li>${e.checked ? '✅' : '⬜'} ${e.label}</li>`).join('')}</ul>

  <h2>12. Protocol Quality</h2>
  <p class="score">${s.intelligence?.qualityScore ?? 0}<span style="font-size:18px;color:#64748b">/100</span></p>
  <p>Completeness: <strong>${s.intelligence?.completeness ?? 0}%</strong></p>
  ${(s.intelligence?.risks || []).length > 0 ? `<p><strong>Identified Risks:</strong></p><ul>${(s.intelligence?.risks || []).map((r: any) => `<li><span class="badge badge-${r.severity?.toLowerCase()}">${r.severity}</span> ${r.message}</li>`).join('')}</ul>` : '<p>No major risks identified.</p>'}
</body>
</html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 600);
      } else {
        alert("Please allow popups for this site to print the protocol.");
      }
    } catch (e) {
      alert("Failed to generate printout.");
    } finally {
      setExporting(null);
    }
  };

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const el = document.createElement('a'); el.setAttribute("href", dataStr); el.setAttribute("download", `${state.title || 'study'}_protocol.json`);
    document.body.appendChild(el); el.click(); el.remove();
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
      <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center shadow-lg shadow-success/20 mb-6"><CheckCircle2 size={40} /></div>
      <h3 className="text-2xl font-black text-slate-800 mb-2">Protocol Finalized</h3>
      <p className="text-slate-500 max-w-sm mx-auto mb-8 text-sm">Your clinical study protocol is structurally complete and verified against international and AYUSH guidelines.</p>
      
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button onClick={handleCopyMarkdown} disabled={exporting !== null} className="h-11 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center gap-2">
          {exporting === "markdown" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy size={14} />}
          Copy Professional Markdown
        </Button>
        <Button onClick={handleDownloadDocx} disabled={exporting !== null} className="h-11 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2">
          {exporting === "docx" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText size={14} />}
          Download Word Document (.docx)
        </Button>
        <Button onClick={handleDownloadHTML} disabled={exporting !== null} className="h-11 text-xs font-bold bg-accent hover:bg-accent-dark text-white flex items-center justify-center gap-2">
          {exporting === "html" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download size={14} />}
          Download / Print HTML Report
        </Button>
        <Button onClick={downloadJSON} className="h-11 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-2">
          <Download size={14} />
          Download Raw JSON
        </Button>
      </div>
    </div>
  );
}

// --- PANE 3 COMPONENTS ---

function IntelligenceDashboard({ state, setActiveStep, loading }: { state: ProtocolState, setActiveStep: (s: number) => void, loading?: boolean }) {
  const intel = state.intelligence;
  
  return (
    <div className="p-6 flex flex-col gap-6 animate-in fade-in h-full overflow-auto bg-slate-50 relative">
      {loading && (
        <div className="absolute top-2 right-4 flex items-center gap-1 text-[10px] text-primary bg-primary-light px-2 py-0.5 rounded animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Analyzing...
        </div>
      )}

      {!intel.calculated ? (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
          <Brain size={40} className="text-slate-300" />
          <h4 className="text-sm font-bold text-slate-500">Awaiting Data</h4>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            The Intelligence Engine will analyze your protocol for completeness, methodological risks, and clinical validity once you provide inputs.
          </p>
        </div>
      ) : (
        <>
          {/* Score Cards */}
      {intel.calculated && (
        <div className="grid grid-cols-2 gap-4 flex-shrink-0">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quality Score</div>
            <div className={`text-5xl font-black ${intel.qualityScore >= 85 ? 'text-success' : intel.qualityScore >= 60 ? 'text-warning' : 'text-danger'}`}>{intel.qualityScore}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Completeness</div>
            <div className="text-4xl font-black text-primary">{intel.completeness}%</div>
          </div>
        </div>
      )}

      {/* Protocol Risks */}
      <div>
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1"><AlertTriangle size={14} /> Identified Risks ({intel.risks.length})</h3>
        <div className="flex flex-col gap-3">
          {intel.risks.length === 0 ? (
            <div className="text-sm text-slate-400 italic bg-white p-4 border border-slate-200 rounded-lg text-center">No major methodological risks detected.</div>
          ) : (
            intel.risks.map((r, idx) => (
              <div key={idx} className={`bg-white border-l-4 ${r.severity === 'High' ? 'border-l-danger' : r.severity === 'Medium' ? 'border-l-warning' : 'border-l-blue-400'} p-3 rounded-r-lg shadow-sm`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge color={r.severity === 'High' ? 'danger' : r.severity === 'Medium' ? 'warning' : 'primary'} className="text-[10px] py-0 px-1">{r.severity} Risk</Badge>
                </div>
                <p className="text-xs text-slate-700 font-medium mb-2">{r.message}</p>
                <button 
                  onClick={() => {
                    const fid = r.fieldId;
                    const stepIdx = STEPS.findIndex(s => s.id === (
                      fid === 'pico' ? 'p' : 
                      fid === 'samplesize' ? 'ss' : 
                      fid === 'confounders' ? 'co' : 
                      fid === 'ethics' ? 'et' : 
                      fid === 'criteria' ? 'cr' :
                      fid === 'ayurveda' ? 'ay' :
                      fid === 'statisticalplan' ? 'sp' :
                      fid === 'hypothesis' ? 'hyp' : 'q'
                    ));
                    if(stepIdx >= 0) setActiveStep(stepIdx);
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors w-full text-left flex justify-between items-center`}
                >
                  Fix: {r.fix} <ChevronRight size={10} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Guideline Compliance */}
      <div>
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1"><CheckSquare size={14} /> Guideline Compliance</h3>
        <div className="flex flex-col gap-2">
          {intel.compliance.map((c, idx) => (
            <div key={idx} className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm flex items-start gap-3">
              <div className="mt-0.5">
                {c.status === 'Fulfilled' ? <CheckCircle2 size={16} className="text-success" /> : c.status === 'Missing' ? <X size={16} className="text-danger" /> : <AlertTriangle size={16} className="text-warning" />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">{c.item}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{c.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function LivePreview({ state }: { state: ProtocolState }) {
  if (!state.intelligence.calculated) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-4">
        <FileText size={40} className="text-slate-300" />
        <h4 className="text-sm font-bold text-slate-500">Protocol Not Started</h4>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Enter a research question and fetch evidence to begin drafting your protocol document.
        </p>
      </div>
    );
  }
  return (
    <div className="w-full bg-white h-full overflow-auto flex flex-col text-slate-800 font-serif p-8">
      <Badge color="accent" className="mb-4 w-max">DRAFT PROTOCOL</Badge>
      <h1 className="text-xl font-bold leading-tight mb-2">
        {state.pico.intervention && state.pico.population ? `Efficacy of ${state.pico.intervention} in ${state.pico.population}` : state.title || "Study Protocol"}
      </h1>
      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider border-b border-slate-200 pb-4 mb-4">ID: BRH-24-{(state.intelligence.qualityScore * 13).toString().padStart(4, '0')}</p>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">1. Background & Rationale</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{state.researchQuestion || <span className="italic text-slate-400">[Pending Rationale]</span>}</p>
        </section>

        <section>
          <h2 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">2. Objectives & Hypotheses</h2>
          <div className="text-xs mb-2"><strong className="text-slate-900">Primary Objective:</strong> {state.hypothesis.primaryObjective}</div>
          <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1 mb-3">
            <li><strong>P:</strong> {state.pico.population || "TBD"}</li>
            <li><strong>I:</strong> {state.pico.intervention || "TBD"}</li>
            <li><strong>C:</strong> {state.pico.comparator || "None"}</li>
            <li><strong>O:</strong> {state.pico.outcome || "TBD"}</li>
          </ul>
          <div className="bg-slate-50 p-3 border-l-2 border-slate-350 text-[11px] space-y-2">
            <p><strong>H1:</strong> {state.hypothesis.primary}</p>
            <p><strong>H0:</strong> {state.hypothesis.nullHypothesis}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">3. Study Design</h2>
          <p className="text-xs text-slate-600 mb-3">Architected as a <strong>{state.studyType.recommended || "TBD"}</strong>.</p>
          <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-3 text-[11px] text-slate-600">
            <strong className="text-slate-900 block mb-1">Sample Size</strong>
            N={state.sampleSizeResult.total} ({state.sampleSizeResult.perArm} per arm) for {Math.round(state.sampleSizeParams.power*100)}% power.
          </div>
          <div className="text-[11px] text-slate-600 space-y-1">
            <p><strong>Primary Analysis:</strong> {state.statisticalPlan.recommendedTest}</p>
            <p><strong>Adjustments:</strong> {state.statisticalPlan.regression}</p>
          </div>
        </section>

        {state.ayurveda.formulation && (
          <section>
            <h2 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide flex items-center gap-1"><Leaf size={12} className="text-success" /> AYUSH Intervention</h2>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-emerald-50/50 p-3 rounded border border-emerald-100">
              <div><strong>Formulation:</strong> {state.ayurveda.formulation}</div>
              <div><strong>Dosage:</strong> {state.ayurveda.dosage}</div>
              <div><strong>Anupana:</strong> {state.ayurveda.anupana}</div>
              <div><strong>Prakriti:</strong> {state.ayurveda.prakriti}</div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ReviewerFeedbackPanel({ state }: { state: ProtocolState }) {
  const highRisks = state.intelligence.risks.filter(r => r.severity === "High");

  if (!state.intelligence.calculated) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-4">
        <ShieldAlert size={40} className="text-slate-300" />
        <h4 className="text-sm font-bold text-slate-500">No Review Available Yet</h4>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Complete the Research Question and Evidence Handoff steps, then fill in PICO fields. The review panel will generate automatically after analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 animate-in fade-in bg-slate-50 h-full overflow-auto text-slate-800 text-xs">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">IRB Reviewer Verdict</h4>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs font-black ${highRisks.length > 0 ? "text-danger" : "text-success"}`}>
            {highRisks.length > 0 ? "REQUIRES MAJOR REVISIONS" : "PROVISIONALLY APPROVED"}
          </span>
          <Badge color={highRisks.length > 0 ? "danger" : "success"}>
            Score: {state.intelligence.qualityScore}/100
          </Badge>
        </div>
      </div>

      <div className="space-y-4 flex-shrink-0">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Methodology Review</h3>
        <div className="bg-white p-4 border border-slate-200 rounded-xl space-y-3">
          <p>The study proposes evaluating <strong>{state.pico.intervention || "[Intervention]"}</strong> on <strong>{state.pico.outcome || "[Outcome]"}</strong> in <strong>{state.pico.population || "[Population]"}</strong>.</p>
          
          <div className="pt-2 border-t border-slate-100">
            <strong className="text-[10px] text-slate-400 block uppercase mb-1">Clinical Rationale Check</strong>
            <p className="italic text-slate-600">"{state.researchQuestion || "Rationale is blank."}"</p>
          </div>
          
          <div className="pt-2 border-t border-slate-100">
            <strong className="text-[10px] text-slate-400 block uppercase mb-1">Statistical Test Appropriateness</strong>
            <p>The selected test <strong>{state.statisticalPlan.recommendedTest}</strong> is {highRisks.length > 0 ? "inappropriate given the high baseline risk profile." : "statistically sound for this architecture."}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Actionable Recommendations</h3>
        {state.intelligence.risks.length === 0 ? (
          <p className="text-[10px] text-slate-500 italic bg-white p-4 border border-slate-200 rounded-xl text-center">No structural adjustments needed.</p>
        ) : (
          state.intelligence.risks.map((r, idx) => (
            <div key={idx} className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
              <span className="font-bold text-slate-700 block mb-1">Recommendation {idx+1}:</span>
              <p className="text-slate-600 mb-2">{r.message}</p>
              <div className="bg-slate-50 p-2 rounded text-slate-600 font-mono text-[10px]"><strong>Fix:</strong> {r.fix}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
