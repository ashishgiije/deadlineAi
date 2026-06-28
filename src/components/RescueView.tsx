import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Project, RescueReport } from "../types";
import { fetchWithRetry } from "../lib/fetchWithRetry";
import { checkRescueConditions } from "../lib/rescueHelper";
import { 
  Flame, 
  Activity, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle, 
  BrainCircuit, 
  RefreshCw, 
  ShieldAlert,
  ArrowRight,
  ShieldAlert as AlertOctagon
} from "lucide-react";

interface RescueViewProps {
  projects: Project[];
  onRefresh: () => void;
  onAddNotification: (title: string, message: string, type: "warning" | "info" | "success" | "danger", projectId: string) => void;
  profile?: any;
  initialSelectedProjId?: string | null;
  onResetInitialSelectedProjId?: () => void;
}

export default function RescueView({ 
  projects, 
  onRefresh, 
  onAddNotification,
  profile,
  initialSelectedProjId,
  onResetInitialSelectedProjId
}: RescueViewProps) {
  const [selectedProjId, setSelectedProjId] = useState("");
  const [rescuing, setRescuing] = useState(false);

  // Sync initialSelectedProjId if navigated with a specific project context
  useEffect(() => {
    if (initialSelectedProjId) {
      setSelectedProjId(initialSelectedProjId);
      if (onResetInitialSelectedProjId) {
        onResetInitialSelectedProjId();
      }
    }
  }, [initialSelectedProjId, onResetInitialSelectedProjId]);


  // Find currently selected project
  const currentProject = projects.find((p) => p.id === selectedProjId);

  // Get only projects with less than 100% progress
  const activeProjectsForRescue = projects.filter((p) => p.progress < 100);

  const handleTriggerRescue = async () => {
    if (!currentProject) return;
    setRescuing(true);

    try {
      const response = await fetchWithRetry("/api/rescue-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: `${currentProject.name}: ${currentProject.description}`,
          deadline: currentProject.deadline,
          progress: currentProject.progress
        })
      });

      if (!response.ok) throw new Error("Rescue API call failed.");

      const rescueData: RescueReport = await response.json();

      // Update project document with rescue parameters
      const projectRef = doc(db, "projects", currentProject.id);
      try {
        await updateDoc(projectRef, { rescue: rescueData });
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.UPDATE, `projects/${currentProject.id}`);
      }

      onRefresh();
      
      onAddNotification(
        "AI Rescue Plan Formulated",
        `Custom emergency schedule compiled successfully. Daily target is set to ${rescueData.daily_target}.`,
        "success",
        currentProject.id
      );

    } catch (err: any) {
      // If it's a Firestore error thrown by handleFirestoreError, rethrow it
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          throw err;
        }
      } catch (_) {
        // Not a handleFirestoreError JSON error, proceed with fallback
      }

      console.error("Rescue mode generation error (running fallback):", err);
      // Failback static rescue plan
      const projectRef = doc(db, "projects", currentProject.id);
      try {
        await updateDoc(projectRef, {
          rescue: {
            status: "Emergency Mode",
            rescue_plan: [
              "Prune non-essential feature requirements immediately.",
              "Consolidate core visual layouts and forms today.",
              "Merge codebase modules and conduct end-to-end integration tests tomorrow.",
              "Verify builds and launch project live on target deployment environment."
            ],
            daily_target: "8 Hours / Day"
          }
        });
        onRefresh();
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.UPDATE, `projects/${currentProject.id}`);
      }
    } finally {
      setRescuing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative glass-card rounded-3xl p-6 overflow-hidden border-rose-500/15">
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Flame className="w-3.5 h-3.5 animate-bounce" />
              <span>AI Rescue Mode</span>
            </div>
            <h2 className="text-3xl font-extrabold font-display tracking-tight text-white">Emergency Plan Generator</h2>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              Lagging progress? Instantly generate direct, milestone-pruned daily emergency targets to bypass developer bottlenecks.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: Selection of lagging projects */}
        <div className="glass-card rounded-2xl p-6 border-slate-800/80 space-y-4">
          <h3 className="text-lg font-bold font-display text-white">Select Lagging Project</h3>
          <p className="text-xs text-slate-400">Choose an active project to analyze and formulate an optimized emergency completion roadmap.</p>
          
          <div className="space-y-3">
            {activeProjectsForRescue.length === 0 ? (
              <p className="text-slate-500 text-xs italic">No active, unfinished projects available for rescue analysis.</p>
            ) : (
              activeProjectsForRescue.map((p) => {
                const rescueStatus = checkRescueConditions(p, profile);
                const isSelected = selectedProjId === p.id;
                
                let borderStyle = isSelected 
                  ? "bg-rose-500/10 border-rose-500/40 text-white shadow-[0_0_15px_rgba(244,63,94,0.15)]" 
                  : "bg-slate-900/30 border-slate-800/60 text-slate-300 hover:border-slate-700/60";

                if (rescueStatus.isNeeded && !isSelected) {
                  borderStyle = "bg-rose-950/10 border-rose-500/30 text-rose-100 hover:border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.08)]";
                }

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjId(p.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden ${borderStyle}`}
                  >
                    {rescueStatus.isNeeded && (
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-rose-500/10 to-transparent pointer-events-none" />
                    )}
                    
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-sm block truncate pr-16">{p.name}</span>
                      <span className="text-[10px] font-mono text-rose-400 shrink-0 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                        {p.risk?.risk_level || "Medium"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                      <span>Progress: {p.progress}%</span>
                      <span className="font-mono">{p.deadline}</span>
                    </div>

                    {/* Reasons list for Rescue Needed */}
                    {rescueStatus.isNeeded && (
                      <div className="mt-3 pt-2 border-t border-rose-500/10 space-y-1">
                        <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 animate-bounce" />
                          <span>Auto Rescue Mode Active</span>
                        </div>
                        <ul className="text-[9px] text-slate-400 list-disc list-inside space-y-0.5 leading-tight">
                          {rescueStatus.reasons.map((r, i) => (
                            <li key={i} className="truncate text-left text-slate-400 font-medium">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right columns: Rescue formulation display */}
        <div className="lg:col-span-2 space-y-6">
          {currentProject ? (
            <div className="glass-card rounded-3xl p-6 border-slate-800/80 space-y-6 relative overflow-hidden">
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-display text-white">{currentProject.name}</h3>
                  <p className="text-xs text-slate-400">Current progress is logged at {currentProject.progress}% with {currentProject.analysis?.available_days || "N/A"} days remaining.</p>
                </div>

                <button
                  onClick={handleTriggerRescue}
                  disabled={rescuing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {rescuing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Formulating Strategy...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <span>{currentProject.rescue ? "Recalculate Rescue Plan" : "Generate AI Rescue Strategy"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Display Calculated Rescue Plan */}
              {currentProject.rescue ? (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <div className="text-[10px] text-rose-400 font-semibold font-mono uppercase tracking-wider">Project Rescue Status</div>
                      <div className="text-xl font-black text-rose-300 mt-1 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse shrink-0" />
                        <span>{currentProject.rescue.status}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="text-[10px] text-amber-400 font-semibold font-mono uppercase tracking-wider">Required Effort Target</div>
                      <div className="text-xl font-black text-amber-300 mt-1 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                        <span>{currentProject.rescue.daily_target}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rescue Timeline steps */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Actionable Emergency Roadmap</h4>
                    <div className="space-y-3.5 relative pl-4 border-l border-rose-500/30">
                      {currentProject.rescue.rescue_plan.map((step, idx) => (
                        <div key={idx} className="relative group">
                          {/* Left bullet circle */}
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-slate-950 group-hover:scale-125 transition-transform" />
                          <div className="p-3.5 rounded-xl bg-[#1e293b]/40 border border-slate-800/80 group-hover:border-rose-500/20 transition-colors flex items-start gap-3">
                            <span className="font-mono text-[10px] text-rose-400 font-bold shrink-0 bg-rose-500/15 px-1.5 py-0.5 rounded-md mt-0.5">
                              STEP {idx + 1}
                            </span>
                            <p className="text-xs text-slate-200 leading-relaxed font-semibold">{step}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warning footer advice */}
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p>
                      <strong>AI Warning:</strong> Bypassing this compiled rescue agenda risks catastrophic project delivery slippage. Focus team capacity on core critical-path mechanics only.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 space-y-3">
                  <BrainCircuit className="w-12 h-12 text-slate-700 mx-auto animate-bounce" />
                  <h4 className="font-bold text-slate-300">Strategy Engine Awaiting Formulation</h4>
                  <p className="text-xs max-w-md mx-auto">Click "Generate AI Rescue Strategy" to let the Gemini model synthesize high-productivity sprints, step-by-step checklists, and safety measures.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center border-slate-800/80 text-slate-500 text-sm">
              <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              Select an active project from the left panel to formulate customized emergency roadmap procedures.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
