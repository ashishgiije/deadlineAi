import React, { useState } from "react";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Project, TaskAnalysis, ProjectPlan, RiskPrediction, AdditionalAiMetrics } from "../types";
import { fetchWithRetry } from "../lib/fetchWithRetry";
import { checkRescueConditions } from "../lib/rescueHelper";
import { 
  Plus, 
  Calendar, 
  Users, 
  Flag, 
  Percent, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  Trash2, 
  RefreshCw, 
  Download, 
  Clock, 
  CheckCircle2, 
  Activity, 
  BrainCircuit,
  PieChart as PieIcon,
  Flame,
  ShieldCheck,
  Search,
  X,
  Target,
  Check,
  ArrowRight
} from "lucide-react";

interface ProjectsViewProps {
  projects: Project[];
  userId: string;
  onRefresh: () => void;
  onAddNotification: (title: string, message: string, type: "warning" | "info" | "success" | "danger", projectId: string) => void;
  onProjectCompleted?: (proj: Project) => void;
  onNavigateToRescue?: (projectId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  profile: any;
  historyLogs?: any[];
  autoOpenCreateProject?: boolean;
  onResetAutoOpenCreateProject?: () => void;
}

const formatStepTime = (hours: number) => {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  if (hours % 1 !== 0) {
    const mins = Math.round((hours % 1) * 60);
    return `${Math.floor(hours)}h ${mins}m`;
  }
  return `${hours}h`;
};

export default function ProjectsView({ 
  projects, 
  userId, 
  onRefresh, 
  onAddNotification,
  onProjectCompleted,
  onNavigateToRescue,
  searchQuery,
  onSearchQueryChange,
  profile,
  historyLogs,
  autoOpenCreateProject,
  onResetAutoOpenCreateProject
}: ProjectsViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Form inputs
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low" | "AI Generated">("Medium");
  const [teamSize, setTeamSize] = useState(1);
  const [progress, setProgress] = useState(0);

  // States
  const [submitting, setSubmitting] = useState(false);
  
  // Advanced feature states
  const [sortBy, setSortBy] = useState<"default" | "priority" | "risk">("default");
  const [customProgress, setCustomProgress] = useState<number>(0);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"overview" | "schedule">("overview");
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState("");
  const [newStepHours, setNewStepHours] = useState(4);
  const [newStepPosition, setNewStepPosition] = useState<number>(1);
  const [newStepUnit, setNewStepUnit] = useState<"hours" | "minutes">("hours");
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projectFilterTab, setProjectFilterTab] = useState<"active" | "completed">("active");

  // Sync custom progress and subtask position default when selected project changes
  React.useEffect(() => {
    if (selectedProject) {
      setCustomProgress(selectedProject.progress);
      setNewStepPosition((selectedProject.plan?.steps?.length || 0) + 1);
    }
  }, [selectedProject?.id, selectedProject?.plan?.steps?.length]);

  React.useEffect(() => {
    if (autoOpenCreateProject) {
      setShowAddModal(true);
      if (onResetAutoOpenCreateProject) {
        onResetAutoOpenCreateProject();
      }
    }
  }, [autoOpenCreateProject, onResetAutoOpenCreateProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !deadline) return;

    setSubmitting(true);

    try {
      // Query the consolidated AI endpoint to perform all checks in ONE model invocation (drastically cuts quota limits)
      const res = await fetchWithRetry("/api/consolidated-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: `${name}: ${description}`,
          deadline,
          progress: Number(progress),
          priority,
          includePlan: true,
          profile,
          historyLogs,
          otherProjects: projects
            .filter((p: any) => p.progress < 100)
            .map((p: any) => ({
              name: p.name,
              deadline: p.deadline,
              total_estimated_hours: p.plan?.total_estimated_hours || p.analysis?.estimated_hours || 40,
              progress: p.progress || 0
            }))
        })
      });

      if (!res.ok) {
        throw new Error("Consolidated AI analysis failed.");
      }

      const consolidatedData = await res.json();
      const isPossible = consolidatedData.possible !== false;
      const analysisData: TaskAnalysis = consolidatedData.analysis || {
        complexity: "High",
        estimated_hours: 1,
        priority: "High",
        risk_level: "High",
        available_days: 1,
        recommended_daily_hours: 1,
        warning: consolidatedData.message || "Impossible"
      };
      const planData: ProjectPlan = consolidatedData.plan || {
        project_duration_days: 1,
        total_estimated_hours: 1,
        daily_required_hours: 1,
        steps: []
      };
      const riskData: RiskPrediction = consolidatedData.risk || {
        risk_score: 100,
        risk_level: "High",
        reasons: [consolidatedData.message || "Impossible task"]
      };
      const additionalData: AdditionalAiMetrics = consolidatedData.additionalAi || {
        daily_goals: [],
        smart_time_allocation: { design_percent: 0, development_percent: 0, testing_percent: 0, deployment_percent: 0 },
        productivity_score: 0,
        project_health_score: 0,
        deadline_probability: 0,
        weekly_progress_report: "Impossible under constraints",
        project_summary: consolidatedData.message || "Impossible task"
      };

      // 2. Add to Firestore projects collection
      let docRef;
      try {
        docRef = await addDoc(collection(db, "projects"), {
          userId,
          name,
          description,
          deadline,
          priority,
          teamSize: Number(teamSize),
          progress: Number(progress),
          createdAt: new Date().toISOString(),
          analysis: analysisData,
          plan: planData,
          risk: riskData,
          additionalAi: additionalData,
          possible: isPossible,
          impossibleMessage: consolidatedData.message || ""
        });
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.CREATE, "projects");
        return;
      }

      // 3. Generate notifications based on AI warnings & predictions
      if (analysisData.warning) {
        onAddNotification(
          "Project Plan Warning",
          analysisData.warning,
          "warning",
          docRef.id
        );
      }

      if (riskData.risk_score > 70) {
        onAddNotification(
          "High Risk Deadline Predicted",
          `Project "${name}" has a critical risk score of ${riskData.risk_score}%. Immediate Rescue recommended.`,
          "danger",
          docRef.id
        );
      }

      if (progress < 20) {
        onAddNotification(
          "Rescue Mode Recommendation",
          `Project "${name}" is initialized with low progress (${progress}%). Trigger AI Rescue to set high productivity routines.`,
          "info",
          docRef.id
        );
      }

      // Reset form
      setName("");
      setDescription("");
      setDeadline("");
      setPriority("Medium");
      setTeamSize(1);
      setProgress(0);
      setShowAddModal(false);
      onRefresh();

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

      console.error("Failed to compile project AI setup (running fallback):", err);
      // Fallback create without full AI
      try {
        const docRef = await addDoc(collection(db, "projects"), {
          userId,
          name,
          description,
          deadline,
          priority,
          teamSize: Number(teamSize),
          progress: Number(progress),
          createdAt: new Date().toISOString(),
          analysis: {
            complexity: "Medium",
            estimated_hours: 40,
            priority: priority,
            risk_level: "Low",
            available_days: 7,
            recommended_daily_hours: 6,
            warning: ""
          },
          plan: {
            project_duration_days: 5,
            total_estimated_hours: 40,
            daily_required_hours: 8,
            steps: [
              { step: "Requirement collection", hours: 8 },
              { step: "Core coding", hours: 24 },
              { step: "Testing and release", hours: 8 }
            ]
          },
          risk: {
            risk_score: 30,
            risk_level: "Low",
            reasons: ["Standard project complexity"]
          }
        });
        onRefresh();
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.CREATE, "projects");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (projId: string) => {
    try {
      await deleteDoc(doc(db, "projects", projId));
      if (selectedProject?.id === projId) setSelectedProject(null);
      onRefresh();
    } catch (err) {
      console.error("Error deleting project:", err);
      handleFirestoreError(err, OperationType.DELETE, `projects/${projId}`);
    }
  };

  const handleReopenProject = async (projId: string, currentProgress: number) => {
    try {
      const newProgress = currentProgress >= 100 ? 80 : 0;
      await updateDoc(doc(db, "projects", projId), { progress: newProgress });
      onRefresh();
      if (selectedProject?.id === projId) {
        setSelectedProject(prev => prev ? { ...prev, progress: newProgress } : null);
      }
      onAddNotification(
        "Project Status Updated",
        `Project reopened and progress set to ${newProgress}%. AI models updated.`,
        "success",
        projId
      );
    } catch (err) {
      console.error("Error updating project status:", err);
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projId}`);
    }
  };

  const handleExportProject = (project: Project) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${project.name.replace(/\s+/g, "_")}_deadlineai_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const reanalyzeProjectWithProgress = async (proj: Project, newProgress: number) => {
    setReanalyzingId(proj.id);
    try {
      onAddNotification(
        "AI Re-analyzing Project",
        `Analyzing progress change to ${newProgress}%. Re-measuring timeline risks and updating milestones...`,
        "info",
        proj.id
      );

      // Create a descriptive task payload listing each subtask checkbox status so AI evaluates it correctly
      const stepsPayload = proj.plan?.steps?.map(s => `- [${proj.completedSteps?.includes(s.step) ? 'X' : ' '}] ${s.step} (${s.hours}h)`).join('\n') || "";
      const taskPayload = `${proj.name} - ${proj.description}\nSubtasks:\n${stepsPayload}`;

      // Call the consolidated analysis endpoint to do all checks in ONE request to avoid 429 quota rate limits
      const res = await fetchWithRetry("/api/consolidated-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: taskPayload,
          deadline: proj.deadline,
          progress: newProgress,
          priority: proj.priority,
          includePlan: false,
          profile,
          historyLogs,
          otherProjects: projects
            .filter((p: any) => p.progress < 100 && p.id !== proj.id)
            .map((p: any) => ({
              name: p.name,
              deadline: p.deadline,
              total_estimated_hours: p.plan?.total_estimated_hours || p.analysis?.estimated_hours || 40,
              progress: p.progress || 0
            }))
        })
      });

      if (!res.ok) {
        throw new Error("AI re-analysis consolidated endpoint failed.");
      }

      const consolidatedData = await res.json();
      const isPossible = consolidatedData.possible !== false;

      const analysisData: TaskAnalysis = consolidatedData.analysis || {
        complexity: proj.analysis?.complexity || "High",
        estimated_hours: proj.analysis?.estimated_hours || 10,
        priority: proj.priority || "High",
        risk_level: proj.analysis?.risk_level || "High",
        available_days: proj.analysis?.available_days || 1,
        recommended_daily_hours: proj.analysis?.recommended_daily_hours || 1,
        warning: consolidatedData.message || proj.analysis?.warning || "Impossible"
      };

      const riskData: RiskPrediction = consolidatedData.risk || {
        risk_score: proj.risk?.risk_score || 100,
        risk_level: proj.risk?.risk_level || "High",
        reasons: consolidatedData.message ? [consolidatedData.message] : (proj.risk?.reasons || ["Unknown risk"])
      };

      const additionalData: AdditionalAiMetrics = consolidatedData.additionalAi || {
        daily_goals: proj.additionalAi?.daily_goals || [],
        smart_time_allocation: proj.additionalAi?.smart_time_allocation || { design_percent: 25, development_percent: 50, testing_percent: 15, deployment_percent: 10 },
        productivity_score: proj.additionalAi?.productivity_score || 75,
        project_health_score: proj.additionalAi?.project_health_score || 75,
        deadline_probability: proj.additionalAi?.deadline_probability || 50,
        weekly_progress_report: proj.additionalAi?.weekly_progress_report || "Under re-evaluation",
        project_summary: consolidatedData.message || proj.additionalAi?.project_summary || proj.name
      };

      // Update Firestore document
      const ref = doc(db, "projects", proj.id);
      await updateDoc(ref, {
        analysis: analysisData,
        risk: riskData,
        additionalAi: additionalData,
        possible: isPossible,
        impossibleMessage: consolidatedData.message || ""
      });

      onRefresh();

      setSelectedProject(prev => {
        if (!prev || prev.id !== proj.id) return prev;
        return {
          ...prev,
          analysis: analysisData,
          risk: riskData,
          additionalAi: additionalData,
          possible: isPossible,
          impossibleMessage: consolidatedData.message || ""
        };
      });

      onAddNotification(
        "AI Re-analysis Complete",
        `Project re-analyzed successfully! Risk level evaluated as "${riskData.risk_level}".`,
        "success",
        proj.id
      );
    } catch (err) {
      console.error("Error during project AI re-analysis:", err);
      onAddNotification(
        "AI Re-analysis Failed",
        "Could not automatically re-measure risk levels. Using existing estimates.",
        "warning",
        proj.id
      );
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleToggleStepCompletion = async (proj: Project, stepName: string) => {
    const completedSteps = proj.completedSteps || [];
    let newCompletedSteps: string[];
    if (completedSteps.includes(stepName)) {
      newCompletedSteps = completedSteps.filter(s => s !== stepName);
    } else {
      newCompletedSteps = [...completedSteps, stepName];
    }

    try {
      const totalSteps = proj.plan?.steps?.length || 1;
      const computedProgress = Math.round((newCompletedSteps.length / totalSteps) * 100);
      const safeProgress = Math.min(100, Math.max(0, computedProgress));

      const ref = doc(db, "projects", proj.id);
      await updateDoc(ref, {
        completedSteps: newCompletedSteps,
        progress: safeProgress
      });

      // Show congratulations popup if completed!
      if (safeProgress >= 100) {
        onProjectCompleted?.({
          ...proj,
          completedSteps: newCompletedSteps,
          progress: safeProgress
        });
      }

      onRefresh();
      
      setSelectedProject(prev => {
        if (!prev || prev.id !== proj.id) return prev;
        return {
          ...prev,
          completedSteps: newCompletedSteps,
          progress: safeProgress
        };
      });

      onAddNotification(
        "AI Step Completed",
        `Checked off step "${stepName}". Progress auto-recalculated to ${computedProgress}%.`,
        "success",
        proj.id
      );

      // Re-analyze project after progress change to measure risk
      await reanalyzeProjectWithProgress(proj, safeProgress);

    } catch (err) {
      console.error("Error updating step completion:", err);
      handleFirestoreError(err, OperationType.UPDATE, `projects/${proj.id}`);
    }
  };

  const handleAddCustomStep = async (stepName: string, hours: number, position: number) => {
    if (!selectedProject || !stepName) return;
    
    try {
      const currentSteps = selectedProject.plan?.steps || [];
      const newSteps = [...currentSteps];
      
      // Calculate index for insertion (position is 1-indexed, so index is position - 1)
      const insertIndex = Math.min(newSteps.length, Math.max(0, position - 1));
      newSteps.splice(insertIndex, 0, { step: stepName, hours });
      
      const updatedPlan = {
        ...(selectedProject.plan || {}),
        steps: newSteps
      };

      const ref = doc(db, "projects", selectedProject.id);
      await updateDoc(ref, {
        plan: updatedPlan
      });

      // Recalculate progress based on new total steps
      const completedSteps = selectedProject.completedSteps || [];
      const computedProgress = Math.round((completedSteps.filter(cs => newSteps.some(ns => ns.step === cs)).length / newSteps.length) * 100);
      const safeProgress = Math.min(100, Math.max(0, computedProgress));

      await updateDoc(ref, {
        progress: safeProgress
      });

      onRefresh();

      setSelectedProject(prev => {
        if (!prev || prev.id !== selectedProject.id) return prev;
        return {
          ...prev,
          plan: updatedPlan,
          progress: safeProgress
        };
      });

      onAddNotification(
        "Custom Sub-task Added",
        `Successfully added "${stepName}" (${hours}h) to the project checklist.`,
        "success",
        selectedProject.id
      );

      // Re-analyze project after updating steps structure to measure risk
      await reanalyzeProjectWithProgress({
        ...selectedProject,
        plan: updatedPlan
      }, safeProgress);

    } catch (err) {
      console.error("Error adding custom step:", err);
      handleFirestoreError(err, OperationType.UPDATE, `projects/${selectedProject.id}`);
    }
  };

  const handleToggleGoalCompletion = async (proj: Project, goalName: string) => {
    const completedGoals = proj.completedGoals || [];
    let newCompletedGoals: string[];
    if (completedGoals.includes(goalName)) {
      newCompletedGoals = completedGoals.filter(g => g !== goalName);
    } else {
      newCompletedGoals = [...completedGoals, goalName];
    }

    try {
      const ref = doc(db, "projects", proj.id);
      await updateDoc(ref, {
        completedGoals: newCompletedGoals
      });

      onRefresh();

      setSelectedProject(prev => {
        if (!prev || prev.id !== proj.id) return prev;
        return {
          ...prev,
          completedGoals: newCompletedGoals
        };
      });

      onAddNotification(
        "Goal Checked Off",
        `Goal "${goalName}" updated in the project backlog.`,
        "info",
        proj.id
      );
    } catch (err) {
      console.error("Error updating goal completion:", err);
      handleFirestoreError(err, OperationType.UPDATE, `projects/${proj.id}`);
    }
  };

  const handleUpdateProgress = async () => {
    if (!selectedProject) return;
    setIsUpdatingProgress(true);
    try {
      const ref = doc(db, "projects", selectedProject.id);
      await updateDoc(ref, {
        progress: customProgress
      });

      // Show congratulations popup if completed!
      if (customProgress >= 100) {
        onProjectCompleted?.({ ...selectedProject, progress: customProgress });
      }

      onRefresh();
      setSelectedProject(prev => {
        if (!prev) return null;
        return { ...prev, progress: customProgress };
      });
      onAddNotification(
        "Progress Customized",
        `Project progress updated to ${customProgress}% as per actual completed milestones.`,
        "success",
        selectedProject.id
      );

      // Re-analyze project after progress change to measure risk
      await reanalyzeProjectWithProgress(selectedProject, customProgress);

    } catch (err) {
      console.error("Error customizing progress:", err);
      handleFirestoreError(err, OperationType.UPDATE, `projects/${selectedProject.id}`);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const generateDateSchedule = (proj: Project) => {
    if (!proj.plan || !proj.plan.steps) return [];
    
    const start = proj.createdAt ? new Date(proj.createdAt) : new Date();
    const end = new Date(proj.deadline);
    
    const diffTime = Math.max(0, end.getTime() - start.getTime());
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    const steps = proj.plan.steps;
    const totalHours = steps.reduce((sum, s) => sum + s.hours, 0) || 1;
    
    let currentDayOffset = 0;
    
    return steps.map((step) => {
      const stepDays = Math.max(1, Math.round((step.hours / totalHours) * totalDays));
      
      const stepStart = new Date(start);
      stepStart.setDate(start.getDate() + currentDayOffset);
      
      const stepEnd = new Date(stepStart);
      stepEnd.setDate(stepStart.getDate() + stepDays - 1);
      
      if (stepEnd > end) {
        stepEnd.setTime(end.getTime());
      }
      if (stepStart > end) {
        stepStart.setTime(end.getTime());
      }
      
      currentDayOffset += stepDays;
      
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const startDateStr = stepStart.toLocaleDateString('en-US', options);
      const endDateStr = stepEnd.toLocaleDateString('en-US', options);
      
      const isDone = proj.completedSteps?.includes(step.step) || false;
      
      return {
        step: step.step,
        hours: step.hours,
        startDateStr,
        endDateStr,
        isDone
      };
    });
  };

  const filteredProjects = projects.filter(p => {
    const nameMatch = p.name ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const descMatch = p.description ? p.description.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    return nameMatch || descMatch;
  });

  const getProjectPriorityValue = (proj: Project) => {
    let p = proj.priority;
    if (p === "AI Generated") {
      const risk = proj.risk?.risk_level || "Medium";
      if (risk === "High") return 3;
      if (risk === "Medium") return 2;
      return 1;
    }
    if (p === "High") return 3;
    if (p === "Medium") return 2;
    return 1;
  };

  const getProjectRiskValue = (proj: Project) => {
    const risk = proj.risk?.risk_level || "Low";
    if (risk === "High") return 3;
    if (risk === "Medium") return 2;
    return 1;
  };

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === "priority") {
      return getProjectPriorityValue(b) - getProjectPriorityValue(a);
    }
    if (sortBy === "risk") {
      return getProjectRiskValue(b) - getProjectRiskValue(a);
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const activeProjects = sortedProjects.filter(p => p.progress < 100);
  const completedProjects = sortedProjects.filter(p => p.progress >= 100);
  const projectsToDisplay = projectFilterTab === "active" ? activeProjects : completedProjects;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-display tracking-tight text-white">Project Backlog</h2>
          <p className="text-slate-400 text-sm">Analyze, outline, track risks, and scale teams beautifully.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>New AI Project</span>
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search project timeline or requirements..."
            className="w-full bg-[#1e293b]/50 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-semibold font-mono uppercase">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#1e293b]/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="default">Date Created (Newest)</option>
            <option value="priority">Priority (High to Low)</option>
            <option value="risk">Risk Level (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Segmented Filter Tabs */}
      <div className="flex border-b border-slate-800/80 max-w-4xl mx-auto">
        <button
          onClick={() => setProjectFilterTab("active")}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
            projectFilterTab === "active"
              ? "border-indigo-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Active Projects</span>
          <span className="font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 text-xs rounded-full">
            {activeProjects.length}
          </span>
        </button>
        <button
          onClick={() => setProjectFilterTab("completed")}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
            projectFilterTab === "completed"
              ? "border-indigo-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Completed Projects</span>
          <span className="font-mono bg-indigo-950 text-indigo-300 px-1.5 py-0.5 text-xs rounded-full border border-indigo-900/30">
            {completedProjects.length}
          </span>
        </button>
      </div>

      {/* Main content layout (full-width single column centered container for accordion style expansion) */}
      <div className="max-w-4xl mx-auto space-y-4">
        {projectsToDisplay.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border-slate-800/80">
            <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-4 animate-bounce" />
            <h3 className="text-lg font-bold font-display text-slate-300">No Projects Found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              {searchQuery ? "No results match your search query." : (projectFilterTab === "active" ? "No active projects. Work on new ideas!" : "No completed projects yet. Finish some tasks to move them here!")}
            </p>
          </div>
        ) : (
          projectsToDisplay.map((project) => {
            const isCompleted = project.progress >= 100;
            const hasAnalysis = !!project.analysis;
            const riskColor = project.risk?.risk_level === "High" ? "text-rose-400" : project.risk?.risk_level === "Medium" ? "text-amber-400" : "text-emerald-400";
            const riskBg = project.risk?.risk_level === "High" ? "bg-rose-500/10" : project.risk?.risk_level === "Medium" ? "bg-amber-500/10" : "bg-emerald-500/10";
            const isSelected = selectedProject?.id === project.id;
            
            const rescueStatus = checkRescueConditions(project, profile);
            const isRescueNeeded = rescueStatus.isNeeded;
            
            let cardBorderClass = isSelected 
              ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-[#1E293B]/20" 
              : "border-slate-800/80 hover:border-slate-700/60";

            if (isRescueNeeded && !isSelected) {
              cardBorderClass = "border-rose-500 bg-rose-950/5 shadow-[0_0_15px_rgba(244,63,94,0.12)] animate-[pulse_2.5s_infinite] hover:border-rose-400";
            } else if (isRescueNeeded && isSelected) {
              cardBorderClass = "border-rose-500 ring-2 ring-rose-500/10 bg-[#1E293B]/20";
            }

            return (
              <div key={project.id} className="space-y-4">
                <div
                  onClick={() => {
                    if (isSelected) {
                      setSelectedProject(null);
                    } else {
                      setSelectedProject(project);
                    }
                  }}
                  className={`glass-card rounded-2xl p-5 border cursor-pointer transition-all relative overflow-hidden ${cardBorderClass}`}
                >
                  {isRescueNeeded && (
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/5 to-transparent pointer-events-none" />
                  )}
                  
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold font-display text-white truncate">{project.name}</h3>
                        {project.priority === "AI Generated" ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border ${
                            project.risk?.risk_level === "High" 
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                              : project.risk?.risk_level === "Medium"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}>
                            <BrainCircuit className="w-3.5 h-3.5" />
                            <span>AI: {project.risk?.risk_level || "Medium"} Priority</span>
                          </span>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            project.priority === "High" ? "bg-rose-500/10 text-rose-400" : project.priority === "Medium" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {project.priority} Priority
                          </span>
                        )}
                        {/* Expanded state indicator badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          isSelected 
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                            : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-indigo-500/30"
                        }`}>
                          {isSelected ? "Collapse Details" : "Click to View AI Copilot"}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm line-clamp-1">{project.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportProject(project);
                        }}
                        title="Export details"
                        className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700/60 text-slate-300 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReopenProject(project.id, project.progress);
                        }}
                        title={isCompleted ? "Reopen project" : "Reset progress"}
                        className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700/60 text-indigo-400 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      {projectToDelete === project.id ? (
                        <div 
                          className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg p-1 animate-pulse" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-rose-400 font-bold px-1 font-mono uppercase tracking-wider">Confirm?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                              setProjectToDelete(null);
                            }}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-md transition-all cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(null);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md transition-all cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(project.id);
                          }}
                          title="Delete project"
                          className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-800/60 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono">DEADLINE</div>
                        <div className="font-semibold text-slate-200">{project.deadline}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono">TEAM SIZE</div>
                        <div className="font-semibold text-slate-200">{project.teamSize} Member{project.teamSize !== 1 ? "s" : ""}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono">WORKLOAD</div>
                        <div className="font-semibold text-slate-200">
                          {project.analysis ? `${project.analysis.estimated_hours} Hours` : "Calculating..."}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono">RISK LEVEL</div>
                        <div className={`font-bold uppercase ${riskColor}`}>
                          {project.risk ? project.risk.risk_level : "Unknown"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-300">Milestone Progress</span>
                      <span className="font-mono text-indigo-400 font-bold">{project.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" 
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Highly Polished Rescue Mode Callout */}
                  {isRescueNeeded && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation(); // Don't trigger accordion expand
                        if (onNavigateToRescue) {
                          onNavigateToRescue(project.id);
                        }
                      }}
                      className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs w-full hover:bg-rose-500/15 transition-all"
                    >
                      <div className="flex items-start gap-2">
                        <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                        <div className="space-y-0.5 text-left">
                          <span className="font-bold block">Automatic Rescue Mode Activated</span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-sm sm:max-w-md md:max-w-lg">
                            Triggered: {rescueStatus.reasons.join(", ")}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-rose-500/20 hover:bg-rose-500/30 px-2.5 py-1 rounded-lg text-white flex items-center gap-1 shrink-0 self-end sm:self-auto">
                        Open AI Rescue <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Expanded AI Copilot Analysis shown directly below the clicked project card */}
                {isSelected && (
                  <div className="glass-card rounded-2xl p-6 border-indigo-500/30 space-y-6 relative overflow-hidden bg-[#1E293B]/40 shadow-inner">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-xl font-bold font-display text-white">AI Copilot Analysis</h3>
                      </div>
                      {reanalyzingId === selectedProject.id && (
                        <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold animate-pulse font-mono">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                          Re-analyzing...
                        </span>
                      )}
                    </div>

                    {/* 1. AI Risk Score Card - DISPLAYED FIRST */}
                    {selectedProject.risk && (
                      <div className="p-4 rounded-xl bg-[#1e293b]/60 border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Deadline Risk Score</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            selectedProject.risk.risk_level === "High" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {selectedProject.risk.risk_level} Risk
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-3xl font-extrabold font-display text-white">
                            {selectedProject.risk.risk_score}%
                          </div>
                          <div className="flex-1 h-2.5 bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                selectedProject.risk.risk_score > 70 ? "bg-rose-500" : selectedProject.risk.risk_score > 40 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${selectedProject.risk.risk_score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Suggestions section */}
                    <div className="space-y-6">
                      {/* Feasibility Warning */}
                      {selectedProject.analysis?.warning && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <p className="font-medium leading-relaxed">{selectedProject.analysis.warning}</p>
                        </div>
                      )}

                      {/* Physically Impossible Project Alert */}
                      {(selectedProject.possible === false || selectedProject.risk?.risk_level === "IMPOSSIBLE" || selectedProject.risk?.risk_level === "Impossible") ? (
                        <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-rose-400 space-y-4 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                          <div className="flex gap-3 items-start">
                            <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <h4 className="text-sm font-bold uppercase tracking-wider font-mono">Physically Impossible Project Detected!</h4>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                {selectedProject.impossibleMessage || selectedProject.risk?.reasons?.[0] || "This task cannot physically be completed under the current constraints."}
                              </p>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-400">
                            <span className="font-bold text-slate-200">AI Intelligent Coaching Advice:</span>
                            <ul className="list-disc pl-4 space-y-1">
                              <li>The estimated duration for this work exceeds your total weekly availability capacity.</li>
                              <li>Do NOT generate fake schedules. You must either extend the deadline date or prune scope.</li>
                              <li>Open the "Productivity Profile" tab to double-check or expand your weekday/weekend hours capacity.</li>
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <>
                          {selectedProject.plan && (
                            <div className="space-y-4">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Suggested AI Plan & Sub-tasks</h4>
                              <div className="relative pl-4 border-l border-indigo-500/30 space-y-3.5">
                                {selectedProject.plan.steps.map((step, idx) => {
                                  const isDone = selectedProject.completedSteps?.includes(step.step) || false;
                                  return (
                                    <div key={idx} className="relative flex items-start gap-2.5 group">
                                      {/* Circle bullet representation */}
                                      <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-slate-950 transition-all ${
                                        isDone ? "bg-indigo-500" : "bg-slate-800"
                                      }`} />
                                      
                                      {/* Checklist Checkbox */}
                                      <button
                                        onClick={() => handleToggleStepCompletion(selectedProject, step.step)}
                                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                          isDone 
                                            ? "bg-indigo-500 border-indigo-400 text-white" 
                                            : "border-slate-700 hover:border-indigo-500 bg-slate-900"
                                        }`}
                                      >
                                        {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                                      </button>

                                      <div className="flex-1 flex justify-between items-start gap-2 text-xs">
                                        <div className="flex flex-col gap-0.5">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-[10px] text-slate-500 bg-slate-900/80 px-1 rounded border border-slate-800">
                                              #{idx + 1}
                                            </span>
                                            <span className={`font-semibold text-slate-300 break-words leading-tight ${isDone ? "line-through text-slate-500 font-normal" : ""}`}>{step.step}</span>
                                          </div>
                                          <div className="flex gap-2 items-center text-[10px] text-slate-500 font-mono pl-6 mt-0.5">
                                            {step.scheduled_time && (
                                              <span className="text-indigo-400 font-bold bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10">
                                                {step.scheduled_time}
                                              </span>
                                            )}
                                            {step.is_weekend_shifted && (
                                              <span className="text-emerald-400 font-bold bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                                                Weekend Optimization
                                              </span>
                                            )}
                                            {step.buffer_applied_hours && (
                                              <span className="text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                                +{step.buffer_applied_hours}h Safety Buffer
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <span className="shrink-0 font-mono text-indigo-400">{formatStepTime(step.hours)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Inline Form to Add Custom Sub-task with sequence positioning */}
                              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                                <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Add Custom Sub-task</div>
                                <div className="flex flex-col md:flex-row gap-2 items-end md:items-center">
                                  <div className="flex-1 w-full space-y-1">
                                    <span className="text-[9px] text-slate-400 font-mono">Task Name</span>
                                    <input 
                                      type="text"
                                      value={newStepName}
                                      onChange={(e) => setNewStepName(e.target.value)}
                                      placeholder="Task name (e.g., Code review)"
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div className="w-20 space-y-1">
                                    <span className="text-[9px] text-slate-400 font-mono block text-center">
                                      {newStepUnit === "hours" ? "Hours" : "Minutes"}
                                    </span>
                                    <input 
                                      type="number"
                                      min="1"
                                      max={newStepUnit === "hours" ? 100 : 600}
                                      value={newStepHours}
                                      onChange={(e) => setNewStepHours(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 text-center focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div className="w-24 space-y-1">
                                <span className="text-[9px] text-slate-400 font-mono block text-center">Unit</span>
                                <select
                                  value={newStepUnit}
                                  onChange={(e) => {
                                    const unit = e.target.value as "hours" | "minutes";
                                    setNewStepUnit(unit);
                                    if (unit === "minutes") {
                                      setNewStepHours(30);
                                    } else {
                                      setNewStepHours(4);
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="hours">Hours</option>
                                  <option value="minutes">Minutes</option>
                                </select>
                              </div>
                              <div className="w-24 space-y-1">
                                <span className="text-[9px] text-slate-400 font-mono block text-center">Position</span>
                                <select
                                  value={newStepPosition}
                                  onChange={(e) => setNewStepPosition(parseInt(e.target.value) || 1)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 text-center focus:outline-none focus:border-indigo-500"
                                >
                                  {Array.from({ length: (selectedProject.plan?.steps?.length || 0) + 1 }).map((_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                      #{i + 1} {i === (selectedProject.plan?.steps?.length || 0) ? "(End)" : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                disabled={!newStepName}
                                onClick={() => {
                                  const finalHours = newStepUnit === "minutes" 
                                    ? parseFloat((newStepHours / 60).toFixed(3)) 
                                    : newStepHours;
                                  handleAddCustomStep(newStepName, finalHours, newStepPosition);
                                  setNewStepName("");
                                  setNewStepHours(4);
                                  setNewStepUnit("hours");
                                }}
                                className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer h-[32px] md:mt-4"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                      {/* Additional AI metrics */}
                      {selectedProject.additionalAi && (
                        <div className="space-y-4 pt-4 border-t border-slate-800/80">
                          {/* Daily goals */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
                              <Target className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Today's Daily Goals</span>
                            </h4>
                            <div className="space-y-1.5">
                              {selectedProject.additionalAi.daily_goals.map((g, idx) => (
                                <div key={idx} className="p-2.5 rounded-lg bg-slate-900/30 border border-slate-800/50 text-xs text-slate-300 flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                  <span>{g}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Summary / Report */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Project AI Summary</h4>
                            <p className="text-xs text-slate-400 leading-relaxed italic bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
                              "{selectedProject.additionalAi.project_summary}"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Complexity, Workload & Feasibility Cards */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Complexity</div>
                          <div className="text-lg font-bold text-white mt-1">
                            {selectedProject.analysis?.complexity || "Calculated"}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Est. Effort</div>
                          <div className="text-lg font-bold text-indigo-400 mt-1">
                            {selectedProject.analysis?.estimated_hours ? `${selectedProject.analysis.estimated_hours}h` : "N/A"}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Available Days</div>
                          <div className="text-lg font-bold text-cyan-400 mt-1">
                            {selectedProject.analysis?.available_days || "N/A"} Days
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Daily Target</div>
                          <div className="text-lg font-bold text-violet-400 mt-1">
                            {selectedProject.analysis?.recommended_daily_hours ? `${selectedProject.analysis.recommended_daily_hours}h/d` : "N/A"}
                          </div>
                        </div>
                      </div>

                      {/* DeadlineAI Personalized Breakdown Card */}
                      {selectedProject.deadlineAi && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900/40 border border-indigo-500/20 shadow-lg space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded bg-indigo-500/10 text-indigo-400">
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                                DeadlineAI Estimation
                              </span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                              selectedProject.deadlineAi.confidence === 'high' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : selectedProject.deadlineAi.confidence === 'medium' 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {selectedProject.deadlineAi.confidence} Confidence
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2 rounded bg-slate-900/50 border border-slate-800">
                              <span className="text-slate-500 block text-[10px] uppercase font-mono">Task Domain</span>
                              <span className="text-white font-medium block mt-0.5">{selectedProject.deadlineAi.task_domain}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900/50 border border-slate-800">
                              <span className="text-slate-500 block text-[10px] uppercase font-mono">Formula Type</span>
                              <span className="text-white font-medium block mt-0.5">
                                {selectedProject.deadlineAi.uses_personalized_estimation ? "🎯 Domain Expertise" : "🌐 Global Average"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-xs py-1">
                            <div className="p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                              <span className="text-[10px] text-indigo-300 uppercase font-mono block">Prod. Score</span>
                              <span className="text-sm font-bold text-indigo-400 block mt-0.5">
                                {selectedProject.deadlineAi.user_productivity_score}/100
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                              <span className="text-[10px] text-cyan-300 uppercase font-mono block">Learning Factor</span>
                              <span className="text-sm font-bold text-cyan-400 block mt-0.5">
                                {selectedProject.deadlineAi.personal_speed_factor}x
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                              <span className="text-[10px] text-emerald-300 uppercase font-mono block">AI Savings</span>
                              <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                                -{selectedProject.deadlineAi.ai_time_saved_percentage}%
                              </span>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-900 flex justify-between items-center">
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase font-mono block">Base Benchmark</span>
                              <span className="text-xs text-slate-400 font-medium line-through">{selectedProject.deadlineAi.base_hours}h</span>
                            </div>
                            <div className="h-6 w-px bg-slate-800" />
                            <div className="text-right">
                              <span className="text-[9px] text-indigo-400 uppercase font-mono block font-bold">Personalized Realtime</span>
                              <span className="text-sm text-indigo-300 font-bold">{selectedProject.deadlineAi.final_estimated_hours} Hours</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed italic bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
                            {selectedProject.deadlineAi.reason}
                          </p>
                        </div>
                      )}

                      {/* Qualitative Risk Reasons and Analysis Details */}
                      {selectedProject.risk?.reasons && selectedProject.risk.reasons.length > 0 && (
                        <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 space-y-2">
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>Risk Reasons & Observations</span>
                          </div>
                          <div className="space-y-1.5">
                            {selectedProject.risk.reasons.map((r, idx) => (
                              <div key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className="text-rose-500/80 font-bold">•</span>
                                <span className="leading-relaxed">{r}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Manual Progress Editor */}
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Customize Project Progress</span>
                        <span className="text-sm font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{customProgress}%</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={customProgress}
                            onChange={(e) => setCustomProgress(parseInt(e.target.value) || 0)}
                            className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 focus:outline-none"
                          />
                          <button
                            onClick={handleUpdateProgress}
                            disabled={isUpdatingProgress || customProgress === selectedProject.progress}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95 disabled:pointer-events-none cursor-pointer"
                          >
                            {isUpdatingProgress ? "Saving..." : "Save"}
                          </button>
                        </div>
                        
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 transition-all duration-300"
                            style={{ width: `${customProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-center items-center p-4">
          <div className="w-full max-w-lg glass-card rounded-3xl p-6 shadow-2xl relative border-indigo-500/20 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold font-display text-white">Create AI-Managed Project</h3>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Project Title / Major Goal
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Build Mobile SaaS Application"
                  className="w-full bg-[#1e293b]/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Description & Key Deliverables
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize key features, expected endpoints, databases, and target metrics."
                  rows={3}
                  className="w-full bg-[#1e293b]/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Deadline Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full bg-[#1e293b]/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-[#1e293b]/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Team Size
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                    className="w-full bg-[#1e293b]/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Current Progress %
                  </label>
                  <div className="flex items-center gap-3 py-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="font-mono text-sm font-bold text-indigo-400">{progress}%</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {submitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Complexity & Planning Tasks...</span>
                  </div>
                ) : (
                  "Analyze & Construct Project"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
