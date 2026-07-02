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
  studyType: { recommended: "Pending", isAuto: true },
  sampleSizeParams: { alpha: 0.05, power: 0.80, effectSize: 0.5, ratio: 1 },
  sampleSizeResult: { total: 0, perArm: 0 },
  statisticalPlan: { primaryEndpoint: "", recommendedTest: "Pending", missingData: "Multiple Imputation (MAR)", regression: "Multivariable Logistic Regression", subgroups: "Age, Gender, Baseline Severity", isAuto: true },
  criteria: { 
    inclusion: [{ id: "i1", text: "Adults aged 18-65" }, { id: "i2", text: "Willing to provide informed consent" }], 
    exclusion: [{ id: "e1", text: "Severe comorbid illness" }, { id: "e2", text: "Pregnancy or lactation" }] 
  },
  confounders: [
    { id: "c1", name: "Age", risk: "Medium", mitigation: "Stratified randomization by age groups." }
  ],
  ayurveda: {
    formulation: "", dosage: "", anupana: "Ushnodaka", prakriti: "Vata-Pitta", duration: "12 Weeks", safety: "LFT/RFT every 4 weeks", standardization: "API compliant"
  },
  timeline: [
    { id: "t1", label: "Protocol Approval", duration: "Month 1", color: "text-success" },
    { id: "t2", label: "Recruitment", duration: "Months 2-6", color: "text-primary" }
  ],
  ethics: [
    { id: "et1", label: "Ethics committee (IRB) approval", checked: false },
    { id: "et2", label: "Trial registration (ClinicalTrials.gov)", checked: false }
  ],
  handoffData: null,
  intelligence: {
    qualityScore: 0, completeness: 0, risks: [], compliance: [], lastCalculated: ""
  }
};

export function StudyDesignStudio() {
  const [activeStep, setActiveStep] = useState(0);
  const [state, setState] = useState<ProtocolState>(DEFAULT_STATE);
  const [versions, setVersions] = useState<{ id: string; timestamp: string; state: ProtocolState }[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [rightPaneView, setRightPaneView] = useState<"intelligence" | "document">("intelligence");

  // Load from localStorage
  useEffect(() => {
    let initialState = { ...DEFAULT_STATE };
    
    const saved = localStorage.getItem("brahma_protocol_state");
    if (saved) {
      try { 
        const parsed = JSON.parse(saved); 
        initialState = { ...DEFAULT_STATE, ...parsed };
        initialState.hypothesis = { ...DEFAULT_STATE.hypothesis, ...(parsed.hypothesis || {}) };
        initialState.statisticalPlan = { ...DEFAULT_STATE.statisticalPlan, ...(parsed.statisticalPlan || {}) };
        initialState.ayurveda = { ...DEFAULT_STATE.ayurveda, ...(parsed.ayurveda || {}) };
      } catch (e) { console.error(e); }
    }

    const handoff = localStorage.getItem("brahma_handoff_collection");
    if (handoff) {
      try { 
        const parsed = JSON.parse(handoff);
        initialState.handoffData = parsed;
        if (parsed.hypothesisSeed && !initialState.researchQuestion) {
          initialState.researchQuestion = parsed.hypothesisSeed;
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

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("brahma_protocol_state", JSON.stringify(state));
      localStorage.setItem("brahma_versions", JSON.stringify(versions));
    }
  }, [state, versions, isLoaded]);

  // Run Intelligence Engine
  useEffect(() => {
    if (isLoaded) {
      const intel = analyzeProtocol(state);
      // Prevent infinite loop by only updating if score/completeness actually changes significantly 
      // (a deep equality check is better, but this simple check prevents loops for now)
      if (intel.qualityScore !== state.intelligence.qualityScore || intel.completeness !== state.intelligence.completeness || intel.risks.length !== state.intelligence.risks.length) {
        setState(prev => ({ ...prev, intelligence: intel }));
      }
    }
  }, [state, isLoaded]);

  const updateState = (updates: Partial<ProtocolState>) => {
    setState(prev => {
      let next = { ...prev, ...updates };
      
      if (next.hypothesis.isAuto) {
        next.hypothesis = { ...next.hypothesis, ...generateHypotheses(next.pico) };
      }
      if (next.studyType.isAuto) {
        next.studyType = { ...next.studyType, ...recommendStudyType(next.pico) };
      }
      
      const zAlpha = next.sampleSizeParams.alpha <= 0.01 ? 2.576 : next.sampleSizeParams.alpha <= 0.05 ? 1.96 : 1.645;
      const zBeta = next.sampleSizeParams.power >= 0.90 ? 1.282 : next.sampleSizeParams.power >= 0.80 ? 0.842 : 0.524;
      if (next.sampleSizeParams.effectSize > 0) {
        const nPerArm = Math.ceil((2 * Math.pow(zAlpha + zBeta, 2)) / Math.pow(next.sampleSizeParams.effectSize, 2));
        next.sampleSizeResult = { perArm: nPerArm, total: nPerArm + Math.ceil(nPerArm * next.sampleSizeParams.ratio) };
      }

      if (next.statisticalPlan.isAuto) {
        const rec = recommendStatisticalTest(next.studyType.recommended, next.pico.outcome || "");
        next.statisticalPlan = { ...next.statisticalPlan, recommendedTest: rec?.value || "Pending", primaryEndpoint: next.pico.outcome || "", aiMetadata: rec };
      }

      return next;
    });
  };

  const saveVersion = () => {
    const v = { id: `v${versions.length + 1}`, timestamp: new Date().toISOString(), state };
    setVersions([v, ...versions]);
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
                  state.intelligence.completeness > (i/STEPS.length)*100 ? "text-slate-700 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <div className="flex items-center gap-2">
                {activeStep === i ? <Edit3 size={14} className="opacity-70" /> : state.intelligence.completeness > (i/STEPS.length)*100 ? <CheckCircle2 size={14} className="text-success opacity-0 group-hover:opacity-100 transition-opacity" /> : <Circle size={14} className="opacity-50" />}
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

      {/* PANE 2: ACTIVE WORKSPACE (AI ASSISTANT INLINE) */}
      <div className="flex-1 flex flex-col overflow-auto bg-slate-50/50 relative">
        <div className="p-6 max-w-3xl mx-auto w-full flex flex-col gap-6 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-2xl font-black text-slate-800">{STEPS[activeStep].label}</h2>
              <p className="text-sm text-slate-500">Step {activeStep + 1} of {STEPS.length}</p>
            </div>
          </div>

          {/* Render Step Components */}
          {activeStep === 0 && <StepResearchQuestion state={state} updateState={updateState} />}
          {activeStep === 1 && <StepEvidenceHandoff state={state} />}
          {activeStep === 2 && <StepPicoBuilder state={state} updateState={updateState} />}
          {activeStep === 3 && <StepHypothesisFormalizer state={state} updateState={updateState} />}
          {activeStep === 4 && <StepStudyType state={state} updateState={updateState} />}
          {activeStep === 5 && <StepSampleSize state={state} updateState={updateState} />}
          {activeStep === 6 && <StepStatisticalPlan state={state} updateState={updateState} />}
          {activeStep === 7 && <StepCriteria state={state} updateState={updateState} />}
          {activeStep === 8 && <StepConfounders state={state} updateState={updateState} />}
          {activeStep === 9 && <StepAyurveda state={state} updateState={updateState} />}
          {activeStep === 10 && <StepTimeline state={state} />}
          {activeStep === 11 && <StepEthics state={state} updateState={updateState} />}
          {activeStep === 12 && <StepExport state={state} />}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <Button variant="outline" onClick={() => setActiveStep(p => Math.max(0, p-1))} disabled={activeStep === 0}>Back</Button>
          <Button className="bg-accent text-white" onClick={() => setActiveStep(p => Math.min(STEPS.length-1, p+1))}>{activeStep === STEPS.length-1 ? "Finish" : "Next"}</Button>
        </div>
      </div>

      {/* PANE 3: INTELLIGENCE DASHBOARD / LIVE PREVIEW */}
      <div className="w-[400px] flex flex-col border-l border-border-light bg-surface shadow-xl z-20 flex-shrink-0">
        <div className="flex border-b border-border-light">
          <button className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${rightPaneView === 'intelligence' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setRightPaneView('intelligence')}>
            <Brain size={16} /> Protocol Intelligence
          </button>
          <button className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${rightPaneView === 'document' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setRightPaneView('document')}>
            <FileText size={16} /> Live Protocol
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50">
          {rightPaneView === 'intelligence' ? <IntelligenceDashboard state={state} setActiveStep={setActiveStep} /> : <LivePreview activeStep={activeStep} state={state} />}
        </div>
      </div>

    </div>
  );
}

// --- STEP COMPONENTS ---

interface StepProps { state: ProtocolState; updateState: (updates: Partial<ProtocolState>) => void; }

function StepResearchQuestion({ state, updateState }: StepProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <textarea className="w-full h-40 p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none shadow-sm" placeholder="Define the primary biological or clinical question..." value={state.researchQuestion} onChange={e => updateState({ researchQuestion: e.target.value })} />
    </div>
  );
}

function StepEvidenceHandoff({ state }: { state: ProtocolState }) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      {state.handoffData ? (
        <Card className="border-success/30 bg-success-light/10">
          <div className="flex items-center gap-2 mb-4 text-success font-bold"><CheckCircle2 size={18} /> Evidence Imported from RECAP</div>
          <div className="text-sm space-y-3 text-slate-700">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200"><span className="font-semibold">Collection ID:</span><Badge color="success">{state.handoffData.id}</Badge></div>
            <div className="bg-white p-3 rounded-lg border border-slate-200"><span className="font-semibold block mb-1">RISHI Hypothesis Seed:</span><p className="italic text-slate-500">{state.handoffData.hypothesisSeed}</p></div>
          </div>
        </Card>
      ) : (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center text-center bg-white"><Database size={32} className="text-slate-300 mb-2" /><h4 className="text-sm font-semibold text-slate-700">No evidence found.</h4></div>
      )}
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
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 shadow-inner">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 text-primary font-bold text-sm"><Brain size={16} /> AI Architect Reasoning</div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${meta.confidence >= 90 ? 'bg-success/20 text-success' : meta.confidence >= 70 ? 'bg-warning/20 text-warning-dark' : 'bg-danger/20 text-danger'}`}>{meta.confidence}% Confidence</div>
      </div>
      <p className="text-sm text-slate-700 mb-3 leading-relaxed">{meta.reasoning}</p>
      {meta.improvements.length > 0 && (
        <div className="bg-white/60 p-3 rounded text-xs text-slate-600 border border-blue-100">
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
  const add = (type: 'inclusion'|'exclusion') => {
    const t = window.prompt(`Enter new ${type} criteria:`);
    if (t) updateState({ criteria: { ...state.criteria, [type]: [...state.criteria[type], { id: Date.now().toString(), text: t }] } });
  };
  const rm = (type: 'inclusion'|'exclusion', id: string) => updateState({ criteria: { ...state.criteria, [type]: state.criteria[type].filter(c => c.id !== id) } });

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      <Card className="border-success/30 bg-success/5"><h4 className="text-sm font-black text-success-dark uppercase tracking-wider mb-3 px-2">Inclusion Criteria</h4><ul className="flex flex-col gap-2">{state.criteria.inclusion.map(c => <li key={c.id} className="text-sm flex justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm"><span className="text-slate-700">• {c.text}</span><button onClick={()=>rm('inclusion', c.id)} className="text-slate-400 hover:text-danger"><X size={16}/></button></li>)}<li onClick={()=>add('inclusion')} className="text-sm text-slate-500 flex items-center justify-center gap-2 p-3 cursor-pointer border-2 border-dashed border-success/30 bg-white hover:bg-success/5 rounded-lg font-bold transition-colors"><Plus size={16}/> Add Inclusion</li></ul></Card>
      <Card className="border-danger/30 bg-danger/5"><h4 className="text-sm font-black text-danger-dark uppercase tracking-wider mb-3 px-2">Exclusion Criteria</h4><ul className="flex flex-col gap-2">{state.criteria.exclusion.map(c => <li key={c.id} className="text-sm flex justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm"><span className="text-slate-700">× {c.text}</span><button onClick={()=>rm('exclusion', c.id)} className="text-slate-400 hover:text-danger"><X size={16}/></button></li>)}<li onClick={()=>add('exclusion')} className="text-sm text-slate-500 flex items-center justify-center gap-2 p-3 cursor-pointer border-2 border-dashed border-danger/30 bg-white hover:bg-danger/5 rounded-lg font-bold transition-colors"><Plus size={16}/> Add Exclusion</li></ul></Card>
    </div>
  );
}

function StepConfounders({ state, updateState }: StepProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
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
    </div>
  );
}

function StepTimeline({ state }: { state: ProtocolState }) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in py-8 px-4">
      <div className="relative border-l-2 border-slate-200 ml-4 space-y-8">
        {state.timeline.map((t) => (
          <div key={t.id} className="relative pl-8">
            <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white ${t.color.replace('text', 'bg')} shadow-sm`} />
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
  const copyMd = () => { navigator.clipboard.writeText("Protocol copied!"); alert("Copied!"); };
  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const el = document.createElement('a'); el.setAttribute("href", dataStr); el.setAttribute("download", "protocol_export.json");
    document.body.appendChild(el); el.click(); el.remove();
  };
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in zoom-in-95">
      <div className="w-24 h-24 bg-success/10 text-success rounded-full flex items-center justify-center shadow-lg shadow-success/20 mb-6"><CheckCircle2 size={48} /></div>
      <h3 className="text-3xl font-black text-slate-800 mb-2">Protocol Finalized</h3>
      <p className="text-slate-500 max-w-sm mx-auto mb-8">Your clinical study protocol is structurally complete and ready for export to EDC systems.</p>
      <div className="flex gap-4 w-full max-w-md">
        <Button onClick={copyMd} className="flex-1 h-12 text-sm font-bold bg-slate-800 hover:bg-slate-900 text-white"><Copy size={16} className="mr-2" /> Markdown</Button>
        <Button onClick={downloadJSON} className="flex-1 h-12 text-sm font-bold bg-accent hover:bg-accent-dark text-white"><Download size={16} className="mr-2" /> JSON</Button>
      </div>
    </div>
  );
}


// --- PANE 3 COMPONENTS ---

function IntelligenceDashboard({ state, setActiveStep }: { state: ProtocolState, setActiveStep: (s: number) => void }) {
  const intel = state.intelligence;
  
  return (
    <div className="p-6 flex flex-col gap-6 animate-in fade-in h-full overflow-auto bg-slate-50">
      {/* Score Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quality Score</div>
          <div className={`text-5xl font-black ${intel.qualityScore >= 80 ? 'text-success' : intel.qualityScore >= 50 ? 'text-warning' : 'text-danger'}`}>{intel.qualityScore}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Completeness</div>
          <div className="text-4xl font-black text-primary">{intel.completeness}%</div>
        </div>
      </div>

      {/* Protocol Risks */}
      <div>
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1"><AlertTriangle size={14} /> Identified Risks ({intel.risks.length})</h3>
        <div className="flex flex-col gap-3">
          {intel.risks.length === 0 ? (
            <div className="text-sm text-slate-400 italic bg-white p-4 border border-slate-200 rounded-lg text-center">No major methodological risks detected.</div>
          ) : (
            intel.risks.map(r => (
              <div key={r.id} className={`bg-white border-l-4 ${r.severity === 'High' ? 'border-l-danger' : r.severity === 'Medium' ? 'border-l-warning' : 'border-l-blue-400'} p-3 rounded-r-lg shadow-sm`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge color={r.severity === 'High' ? 'danger' : r.severity === 'Medium' ? 'warning' : 'primary'} className="text-[10px] py-0 px-1">{r.severity} Risk</Badge>
                </div>
                <p className="text-xs text-slate-700 font-medium mb-2">{r.message}</p>
                <button 
                  onClick={() => {
                    const stepIdx = STEPS.findIndex(s => s.id === (r.fieldId === 'pico' ? 'p' : r.fieldId === 'samplesize' ? 'ss' : r.fieldId === 'confounders' ? 'co' : r.fieldId === 'ethics' ? 'et' : 'q'));
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
          {intel.compliance.map(c => (
            <div key={c.id} className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm flex items-start gap-3">
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
    </div>
  );
}

function LivePreview({ state }: { activeStep: number, state: ProtocolState }) {
  return (
    <div className="w-full bg-white h-full overflow-auto flex flex-col text-slate-800 font-serif p-8">
      <Badge color="accent" className="mb-4 w-max">DRAFT PROTOCOL</Badge>
      <h1 className="text-2xl font-bold leading-tight mb-2">
        {state.pico.intervention && state.pico.population ? `Efficacy of ${state.pico.intervention} in ${state.pico.population}` : "Study Protocol"}
      </h1>
      <p className="text-xs text-slate-500 font-mono uppercase tracking-wider border-b border-slate-200 pb-6 mb-6">ID: BRH-24-{(state.intelligence.qualityScore * 13).toString().padStart(4, '0')}</p>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">1. Background & Rationale</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{state.researchQuestion || <span className="italic text-slate-400">[Pending]</span>}</p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">2. Objectives & Hypotheses</h2>
          <div className="text-sm mb-2"><strong className="text-slate-900">Primary Objective:</strong> {state.hypothesis.primaryObjective}</div>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 mb-3">
            <li><strong>P:</strong> {state.pico.population || "TBD"}</li>
            <li><strong>I:</strong> {state.pico.intervention || "TBD"}</li>
            <li><strong>C:</strong> {state.pico.comparator || "None"}</li>
            <li><strong>O:</strong> {state.pico.outcome || "TBD"}</li>
          </ul>
          <div className="bg-slate-50 p-3 border-l-2 border-slate-300 text-xs space-y-2">
            <p><strong>H1:</strong> {state.hypothesis.primary}</p>
            <p><strong>H0:</strong> {state.hypothesis.nullHypothesis}</p>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">3. Study Design</h2>
          <p className="text-sm text-slate-600 mb-3">Architected as a <strong>{state.studyType.recommended || "TBD"}</strong>.</p>
          <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-3 text-xs text-slate-600">
            <strong className="text-slate-900 block mb-1">Sample Size</strong>
            N={state.sampleSizeResult.total} ({state.sampleSizeResult.perArm} per arm) for {Math.round(state.sampleSizeParams.power*100)}% power.
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p><strong>Primary Analysis:</strong> {state.statisticalPlan.recommendedTest}</p>
            <p><strong>Adjustments:</strong> {state.statisticalPlan.regression}</p>
          </div>
        </section>

        {state.ayurveda.formulation && (
          <section>
            <h2 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide flex items-center gap-1"><Leaf size={14} className="text-success" /> AYUSH Intervention</h2>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-emerald-50 p-3 rounded border border-emerald-100">
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
