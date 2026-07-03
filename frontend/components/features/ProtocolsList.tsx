"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Plus, Trash2, Edit, Filter, FileText, 
  CheckCircle, AlertTriangle, AlertCircle, RefreshCw 
} from "lucide-react";
import { fetchStudies, deleteStudy, createStudy, StudyProtocol } from "../../lib/api";
import { Badge } from "../shared/Badge";
import { Card } from "../shared/Card";

interface ProtocolsListProps {
  setActivePage: (page: string) => void;
}

export function ProtocolsList({ setActivePage }: ProtocolsListProps) {
  const [studies, setStudies] = useState<StudyProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [studyType, setStudyType] = useState("");
  const [minCompleteness, setMinCompleteness] = useState("");
  const [minQuality, setMinQuality] = useState("");
  
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadStudies();
  }, [search, studyType, minCompleteness, minQuality]);

  const loadStudies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStudies(
        1, 
        50, 
        search || undefined, 
        studyType || undefined
      );
      
      // Additional client-side filters if needed, but primary filtering is done in backend
      let results = data.results;
      if (minCompleteness) {
        results = results.filter(s => (s.completeness || 0) >= parseInt(minCompleteness));
      }
      if (minQuality) {
        results = results.filter(s => (s.quality_score || 0) >= parseInt(minQuality));
      }
      
      setStudies(results);
    } catch (err: any) {
      console.error(err);
      setError("Unable to connect to the backend server. Displaying offline storage protocols.");
      // Fallback: load local storage study
      const local = localStorage.getItem("brahma_protocol_state");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setStudies([parsed]);
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this study protocol?")) return;
    setIsDeleting(id);
    try {
      await deleteStudy(id);
      setStudies(prev => prev.filter(s => s.id !== id));
      
      // If deleted active study from localstorage, clean it
      const local = localStorage.getItem("brahma_protocol_state");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed.id === id) {
            localStorage.removeItem("brahma_protocol_state");
          }
        } catch (e) {}
      }
    } catch (err) {
      alert("Failed to delete study. Please check backend connection.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (study: StudyProtocol) => {
    localStorage.setItem("brahma_protocol_state", JSON.stringify(study));
    setActivePage("design");
  };

  const handleCreateNew = async () => {
    const title = prompt("Enter a title for the new research study protocol:");
    if (!title || !title.trim()) return;

    setIsCreating(true);
    try {
      const newProto: StudyProtocol = {
        title: title.trim(),
        research_question: "",
        pico: { population: "", intervention: "", comparator: "", outcome: "" },
        hypothesis: {
          primary: "", nullHypothesis: "", alternative: "", primaryObjective: "", secondaryObjectives: [], isAuto: true
        },
        study_type: { recommended: "Pending", isAuto: true },
        sample_size: { alpha: 0.05, power: 0.80, effectSize: 0.5, ratio: 1 },
        statistical_plan: {
          primaryEndpoint: "", recommendedTest: "Pending", missingData: "Multiple Imputation (MAR)", regression: "Multivariable Logistic Regression", subgroups: "Age, Gender, Baseline Severity", isAuto: true
        },
        eligibility: { inclusion: [], exclusion: [] },
        confounders: [],
        ayush_protocol: {
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
        snapshots: [],
        quality_score: 0,
        completeness: 0,
        risks: [],
        compliance: []
      };

      const created = await createStudy(newProto);
      localStorage.setItem("brahma_protocol_state", JSON.stringify(created));
      setActivePage("design");
    } catch (err) {
      alert("Failed to create study on backend. Creating in offline mode.");
      const offlineProto = {
        id: Date.now(), // Mock ID
        title: title.trim(),
        research_question: "",
        pico: { population: "", intervention: "", comparator: "", outcome: "" },
        hypothesis: { primary: "", nullHypothesis: "", alternative: "", primaryObjective: "", secondaryObjectives: [], isAuto: true },
        study_type: { recommended: "Pending", isAuto: true },
        sample_size: { alpha: 0.05, power: 0.80, effectSize: 0.5, ratio: 1 },
        statistical_plan: { primaryEndpoint: "", recommendedTest: "Pending", missingData: "Multiple Imputation (MAR)", regression: "Multivariable Logistic Regression", subgroups: "Age, Gender, Baseline Severity", isAuto: true },
        eligibility: { inclusion: [], exclusion: [] },
        confounders: [],
        ayush_protocol: { formulation: "", dosage: "", anupana: "Ushnodaka", prakriti: "Vata-Pitta", duration: "12 Weeks", safety: "LFT/RFT every 4 weeks", standardization: "API compliant" },
        timeline: [
          { id: "t1", label: "Protocol Approval", duration: "Month 1", color: "text-success" },
          { id: "t2", label: "Recruitment", duration: "Months 2-6", color: "text-primary" }
        ],
        ethics: [
          { id: "et1", label: "Ethics committee (IRB) approval", checked: false },
          { id: "et2", label: "Trial registration (ClinicalTrials.gov)", checked: false }
        ],
        snapshots: [],
        quality_score: 0,
        completeness: 0,
        risks: [],
        compliance: []
      };
      localStorage.setItem("brahma_protocol_state", JSON.stringify(offlineProto));
      setActivePage("design");
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (completeness: number) => {
    if (completeness === 100) return <Badge color="success">Complete</Badge>;
    if (completeness >= 80) return <Badge color="primary">Review Ready</Badge>;
    return <Badge color="warning">Draft</Badge>;
  };

  return (
    <div className="flex-1 p-8 bg-background flex flex-col overflow-auto font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Saved Protocols</h1>
          <p className="text-text-muted mt-1">Manage and audit your generated clinical study protocols.</p>
        </div>
        <button 
          onClick={handleCreateNew}
          disabled={isCreating}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/95 transition-colors flex items-center gap-2 shadow-sm"
        >
          {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          New Protocol
        </button>
      </div>

      {/* Connection warning */}
      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters board */}
      <div className="bg-surface border border-border-light rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-text-dim absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by title or question..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border-light rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-dim" />
          <select 
            value={studyType} 
            onChange={e => setStudyType(e.target.value)}
            className="bg-background border border-border-light rounded-lg py-2 px-3 text-sm focus:outline-none"
          >
            <option value="">All Designs</option>
            <option value="RCT">RCT</option>
            <option value="Single-Arm">Single-Arm</option>
            <option value="Cohort">Cohort Study</option>
          </select>
        </div>

        <select 
          value={minCompleteness} 
          onChange={e => setMinCompleteness(e.target.value)}
          className="bg-background border border-border-light rounded-lg py-2 px-3 text-sm focus:outline-none"
        >
          <option value="">Any Completeness</option>
          <option value="80">80%+ (Review Ready)</option>
          <option value="100">100% (Complete)</option>
        </select>

        <select 
          value={minQuality} 
          onChange={e => setMinQuality(e.target.value)}
          className="bg-background border border-border-light rounded-lg py-2 px-3 text-sm focus:outline-none"
        >
          <option value="">Any Quality Score</option>
          <option value="80">80+ (High Quality)</option>
          <option value="60">60+ (Medium Quality)</option>
        </select>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-2" />
          <span className="text-sm text-text-muted">Loading saved protocols...</span>
        </div>
      ) : studies.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border-light rounded-2xl bg-surface/50 p-8">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center text-primary mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No protocols found</h3>
          <p className="text-sm text-text-muted mt-1 max-w-sm text-center mb-6">
            No saved study protocols match your current search and filter settings.
          </p>
          <button 
            onClick={handleCreateNew}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Create Protocol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studies.map(study => (
            <Card key={study.id} className="border border-border-light bg-surface hover:shadow-md transition-shadow flex flex-col h-[220px]">
              <div className="flex justify-between items-start mb-3">
                <div className="max-w-[70%]">
                  <h3 className="text-base font-bold text-foreground truncate">{study.title}</h3>
                  <span className="text-xs text-text-muted">
                    Last updated: {study.updated_at ? new Date(study.updated_at).toLocaleDateString() : "Just now"}
                  </span>
                </div>
                {getStatusBadge(study.completeness || 0)}
              </div>
              
              <p className="text-xs text-text-muted line-clamp-3 mb-4 flex-1">
                {study.research_question || "No scientific rationale defined yet."}
              </p>
              
              <div className="border-t border-border-light pt-3 flex items-center justify-between mt-auto">
                <div className="flex gap-3 text-xs">
                  <div>
                    <span className="text-text-dim block">Quality</span>
                    <span className={`font-bold ${study.quality_score && study.quality_score >= 80 ? 'text-success' : 'text-warning'}`}>
                      {study.quality_score || 0}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-text-dim block">Completeness</span>
                    <span className="font-bold text-primary">{study.completeness || 0}%</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(study)}
                    className="p-2 text-text-dim hover:text-primary hover:bg-surface-hover rounded-lg transition-colors border border-transparent hover:border-border-light"
                    title="Edit Protocol"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => study.id && handleDelete(study.id)}
                    disabled={isDeleting === study.id}
                    className="p-2 text-text-dim hover:text-danger hover:bg-danger/10 rounded-lg transition-colors border border-transparent"
                    title="Delete Protocol"
                  >
                    {isDeleting === study.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
