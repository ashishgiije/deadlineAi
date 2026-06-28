import React, { useState } from "react";
import { Project, NotificationItem } from "../types";
import { checkRescueConditions } from "../lib/rescueHelper";
import { 
  FolderKanban, 
  CheckCircle, 
  Activity, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  BrainCircuit, 
  Sparkles, 
  CheckCircle2, 
  Info,
  Calendar,
  XCircle,
  BellRing,
  Check,
  Target,
  ShieldAlert,
  Flame,
  ArrowRight,
  ListTodo,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface DashboardViewProps {
  projects: Project[];
  notifications: NotificationItem[];
  onClearNotification: (id: string) => void;
  onNavigateToTab: (tab: string) => void;
  onNavigateToRescue?: (projectId: string) => void;
  userName: string;
  onToggleStep: (projectId: string, stepName: string) => void;
  profile: any;
  onToggleGoal: (projectId: string, goalName: string) => void;
  manualGoals?: any[];
  onAddManualGoal?: (text: string) => void;
  onToggleManualGoal?: (id: string) => void;
  onDeleteManualGoal?: (id: string) => void;
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

export default function DashboardView({
  projects,
  notifications,
  onClearNotification,
  onNavigateToTab,
  onNavigateToRescue,
  userName,
  onToggleStep,
  profile,
  onToggleGoal,
  manualGoals = [],
  onAddManualGoal,
  onToggleManualGoal,
  onDeleteManualGoal
}: DashboardViewProps) {
  // Stat calculations
  const totalProjects = projects.filter((p) => !p.archived).length;
  const completedProjects = projects.filter((p) => p.progress >= 100 || p.archived).length;
  const activeProjects = projects.filter((p) => p.progress < 100 && !p.archived).length;
  
  const today = new Date();
  const overdueProjects = projects.filter((p) => {
    if (p.progress >= 100 || p.archived) return false;
    const deadlineDate = new Date(p.deadline);
    return deadlineDate < today;
  }).length;

  const averageCompletion = totalProjects > 0 
    ? Math.round(projects.filter((p) => !p.archived).reduce((acc, curr) => acc + curr.progress, 0) / totalProjects)
    : 0;

  // State for the interactive Weekly Planner
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newGoalText, setNewGoalText] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  const handleAddGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    if (onAddManualGoal) {
      onAddManualGoal(newGoalText.trim());
    }
    setNewGoalText("");
  };

  // Generate the next 7 days based on weekOffset (today + weekOffset + i)
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset + i);
    return d;
  });

  // Calculate planned sub-tasks for a given date
  const getTasksForDate = (date: Date, isInternalCall = false) => {
    const tasks: Array<{
      projectId: string;
      projectName: string;
      projectRisk: string;
      stepName: string;
      hours: number;
      isDone: boolean;
      isNextDayTask?: boolean;
      isSuggestedTomorrowTask?: boolean;
    }> = [];

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    projects.forEach((proj) => {
      // Only check projects that are active/incomplete (or completed but still need progress viewing)
      if (proj.progress >= 100) return;
      if (!proj.plan || !proj.plan.steps) return;

      const start = proj.createdAt ? new Date(proj.createdAt) : new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date(proj.deadline);
      end.setHours(23, 59, 59, 999);

      const diffTime = Math.max(0, end.getTime() - start.getTime());
      const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      const steps = proj.plan.steps;
      const totalHours = steps.reduce((sum, s) => sum + s.hours, 0) || 1;
      const completedSteps = proj.completedSteps || [];
      const uncompletedSteps = steps.filter(s => !completedSteps.includes(s.step));

      const isToday = checkDate.toDateString() === new Date().toDateString();

      // 1. If we are on Today's date, include all completed steps to reward the user and show accomplishments
      if (isToday) {
        steps.forEach((step) => {
          if (completedSteps.includes(step.step)) {
            tasks.push({
              projectId: proj.id,
              projectName: proj.name,
              projectRisk: proj.risk?.risk_level || "Medium",
              stepName: step.step,
              hours: step.hours,
              isDone: true
            });
          }
        });
      }

      // Check if the project is single-day or a punctual errand/event that must be done on the target date only
      const isSingleDayOrPunctual = (() => {
        if (totalDays <= 1) return true;
        
        const lowerName = proj.name.toLowerCase();
        const lowerDesc = (proj.description || "").toLowerCase();
        
        // Divisible multi-day projects (should be spread out over multiple days)
        const divisibleKeywords = [
          "create", "build", "design", "develop", "website", "app", "code", "coding", "software",
          "program", "programming", "system", "project", "prototype", "wireframe", "write", "writing",
          "thesis", "report", "essay", "paper", "research", "study", "studying", "learn", "learning",
          "prepare", "preparation", "course", "homework", "assignment", "renovate", "renovation", "campaign"
        ];
        
        const hasDivisibleKeyword = divisibleKeywords.some(keyword => 
          lowerName.includes(keyword) || lowerDesc.includes(keyword)
        );

        // Punctual errands, events, or specific one-day commitments
        const punctualKeywords = [
          "pick up", "pickup", "meet", "meeting", "flight", "concert", "event", "arrival", "arrive",
          "delivery", "deliver", "appointment", "party", "visit", "exam", "interview", "call", "session",
          "reservation", "ticket", "station", "shop", "shopping", "buy", "purchase", "gift", "store",
          "market", "groceries", "grocery", "family", "parent", "railway", "train", "dinner", "lunch", "brunch",
          "breakfast", "movie", "wedding", "doctor", "dentist", "clinic", "hospital", "gathering", "drop off",
          "dropoff", "bank", "laundry"
        ];
        
        const hasPunctualKeyword = punctualKeywords.some(keyword => 
          lowerName.includes(keyword) || lowerDesc.includes(keyword)
        );

        if (hasDivisibleKeyword && !hasPunctualKeyword) {
          return false; // Definitely a divisible project, spread over multiple days
        }
        
        if (hasPunctualKeyword) {
          return true; // Errand/event that can only happen on the target date
        }

        // Fallback: If it's more than 1 day and doesn't match punctual keywords,
        // treat as divisible so the user has buffer and doesn't miss the deadline.
        return false;
      })();

      // 2. Schedule remaining uncompleted steps
      if (uncompletedSteps.length > 0) {
        let currentDayOffset = 0;
        uncompletedSteps.forEach((step) => {
          // If the project is single-day or punctual, strictly only put sub-tasks on the target (deadline) date
          if (isSingleDayOrPunctual) {
            const deadlineDate = new Date(proj.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const targetDate = deadlineDate < today ? today : deadlineDate;
            
            if (checkDate.toDateString() === targetDate.toDateString()) {
              tasks.push({
                projectId: proj.id,
                projectName: proj.name,
                projectRisk: proj.risk?.risk_level || "Medium",
                stepName: step.step,
                hours: step.hours,
                isDone: false,
                isNextDayTask: false
              });
            }
            return;
          }

          // If the step has a scheduled_time assigned by the server, match it with the checkDate
          if (step.scheduled_time) {
            const datePart = step.scheduled_time.split('(')[0].trim().toLowerCase(); // e.g. "jun 28"
            const checkDateStr = checkDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
            
            const parts = datePart.split(' ');
            let matches = false;
            if (parts.length >= 2) {
              const monthPart = parts[0];
              const dayPart = parseInt(parts[1], 10);
              const checkMonth = checkDate.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
              const checkDay = checkDate.getDate();
              
              if (monthPart.startsWith(checkMonth.substring(0, 3)) && dayPart === checkDay) {
                matches = true;
              }
            }
            
            if (matches || datePart === checkDateStr || step.scheduled_time.toLowerCase().includes(checkDateStr)) {
              tasks.push({
                projectId: proj.id,
                projectName: proj.name,
                projectRisk: proj.risk?.risk_level || "Medium",
                stepName: step.step,
                hours: step.hours,
                isDone: false,
                isNextDayTask: false
              });
            }
            return;
          } else {
            // Dynamic forward-shifting scheduler for multi-day projects:
            // Calculate project timeline parameters using the Intelligent Scheduling Window algorithm
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const deadlineDate = new Date(proj.deadline);
            deadlineDate.setHours(0, 0, 0, 0);

            const msToDeadline = deadlineDate.getTime() - today.getTime();
            const daysToDeadline = Math.max(0, Math.ceil(msToDeadline / (1000 * 60 * 60 * 24)));

            const requiredHours = proj.plan?.total_estimated_hours || steps.reduce((sum, s) => sum + s.hours, 0) || 40;
            const userCapacity = Math.max(0.5, profile?.daily_work_hours || profile?.weekday_hours || 2);
            const minDaysNeeded = requiredHours / userCapacity;
            const bufferedDaysNeeded = Math.ceil(minDaysNeeded * 1.2);

            let workStartDate = new Date(today);
            if (daysToDeadline > bufferedDaysNeeded) {
              const startOffset = daysToDeadline - bufferedDaysNeeded;
              workStartDate.setDate(today.getDate() + startOffset);
            }
            workStartDate.setHours(0, 0, 0, 0);

            // Schedule only uncompleted steps starting from max(workStartDate, start) up to the deadline (end)
            const schedStart = new Date(Math.max(workStartDate.getTime(), start.getTime()));
            schedStart.setHours(0, 0, 0, 0);

            const schedEnd = new Date(end);
            schedEnd.setHours(23, 59, 59, 999);

            const diffRemaining = Math.max(0, schedEnd.getTime() - schedStart.getTime());
            const remainingDays = Math.max(1, Math.ceil(diffRemaining / (1000 * 60 * 60 * 24)));

            const totalRemainingHours = uncompletedSteps.reduce((sum, s) => sum + s.hours, 0) || 1;

            // Compute the original schedule of the steps as if none were completed yet
            // to understand when they were originally supposed to start.
            let origDayOffset = 0;
            const origSchedules = steps.map((s) => {
              const stepDays = Math.max(1, Math.round((s.hours / totalHours) * totalDays));
              const stepStart = new Date(start);
              stepStart.setDate(start.getDate() + origDayOffset);
              stepStart.setHours(0, 0, 0, 0);
              
              const stepEnd = new Date(stepStart);
              stepEnd.setDate(stepStart.getDate() + stepDays - 1);
              stepEnd.setHours(23, 59, 59, 999);
              
              origDayOffset += stepDays;
              return { step: s.step, stepStart };
            });

            const stepDays = Math.max(1, Math.round((step.hours / totalRemainingHours) * remainingDays));

            const stepStart = new Date(schedStart);
            stepStart.setDate(schedStart.getDate() + currentDayOffset);
            stepStart.setHours(0, 0, 0, 0);

            const stepEnd = new Date(stepStart);
            stepEnd.setDate(stepStart.getDate() + stepDays - 1);
            stepEnd.setHours(23, 59, 59, 999);

            if (stepEnd > end) {
              stepEnd.setTime(end.getTime());
            }
            if (stepStart > end) {
              stepStart.setTime(end.getTime());
            }

            currentDayOffset += stepDays;

            if (checkDate >= stepStart && checkDate <= stepEnd) {
              const origSched = origSchedules.find((os) => os.step === step.step);
              // It's a next day task if we are displaying it on today's date, 
              // and its original scheduled start date was strictly after today.
              const isNextDayTask = isToday && origSched && origSched.stepStart > today;

              tasks.push({
                projectId: proj.id,
                projectName: proj.name,
                projectRisk: proj.risk?.risk_level || "Medium",
                stepName: step.step,
                hours: step.hours,
                isDone: false,
                isNextDayTask: !!isNextDayTask
              });
            }
          }
        });
      }
    });

    const isToday = checkDate.toDateString() === new Date().toDateString();

    if (!isInternalCall && isToday) {
      const todayUncompleted = tasks.filter(t => !t.isDone);
      const todayCompleted = tasks.filter(t => t.isDone);
      
      // If there are no uncompleted tasks for today, and either some are completed OR there is an active project
      const allTodayCompleted = todayUncompleted.length === 0 && (todayCompleted.length > 0 || projects.some(p => !p.archived && p.progress < 100));
      
      if (allTodayCompleted) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const tomorrowTasks = getTasksForDate(tomorrow, true);
        tomorrowTasks.forEach((t) => {
          const alreadyAdded = tasks.some(existing => existing.projectId === t.projectId && existing.stepName === t.stepName);
          if (!alreadyAdded) {
            tasks.push({
              ...t,
              isSuggestedTomorrowTask: true
            });
          }
        });
      }
    }

    // Prioritize the subtasks based on project criticality, risk, priority, and deadline:
    tasks.sort((a, b) => {
      // 1. Completed tasks stay at the bottom
      if (a.isDone !== b.isDone) {
        return a.isDone ? 1 : -1;
      }

      const projA = projects.find(p => p.id === a.projectId);
      const projB = projects.find(p => p.id === b.projectId);
      if (!projA) return 1;
      if (!projB) return -1;

      // 2. Critical rescue mode active first
      const rescueA = checkRescueConditions(projA, profile).isNeeded ? 1 : 0;
      const rescueB = checkRescueConditions(projB, profile).isNeeded ? 1 : 0;
      if (rescueA !== rescueB) {
        return rescueB - rescueA;
      }

      // 3. High Risk level first
      const getRiskWeight = (p: any) => {
        const lvl = String(p.risk?.risk_level || "").toLowerCase();
        if (lvl === "high") return 3;
        if (lvl === "medium") return 2;
        return 1;
      };
      const rA = getRiskWeight(projA);
      const rB = getRiskWeight(projB);
      if (rA !== rB) {
        return rB - rA;
      }

      // 4. Project priority first
      const getPriorityWeight = (p: any) => {
        const prio = String(p.priority || "").toLowerCase();
        if (prio === "high") return 3;
        if (prio === "medium") return 2;
        return 1;
      };
      const pA = getPriorityWeight(projA);
      const pB = getPriorityWeight(projB);
      if (pA !== pB) {
        return pB - pA;
      }

      // 5. Sooner deadline first
      const timeA = new Date(projA.deadline).getTime();
      const timeB = new Date(projB.deadline).getTime();
      return timeA - timeB;
    });

    return tasks;
  };

  const dailyTasks = getTasksForDate(selectedDate);
  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();
  const uncompletedDailyTasks = dailyTasks.filter(t => !t.isDone && !t.isSuggestedTomorrowTask);
  const totalHoursToSpend = uncompletedDailyTasks.reduce((sum, t) => sum + t.hours, 0);

  const getDayLabel = (date: Date) => {
    const todayStr = new Date().toDateString();
    if (date.toDateString() === todayStr) return "Today";
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  return (
    <div className="space-y-6">
      {/* Productivity profile optimization notice */}
      {!profile && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-indigo-400 shrink-0" />
            <p className="text-slate-300">
              <span className="font-bold text-slate-100 block sm:inline">Boost Scheduling Accuracy: </span>Complete your productivity profile for better AI scheduling accuracy.
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab("profile")}
            className="text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider font-mono shrink-0 cursor-pointer text-[10px]"
          >
            Complete Profile &rarr;
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="relative glass-card rounded-2xl p-4 md:p-5 overflow-hidden border-indigo-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/20 to-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5 text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BrainCircuit className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>AI Agent Online</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white font-display">
              Welcome, {userName || "Developer"}
            </h2>
            <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
              AI-driven project risk forecasting, automated time allocation, and instant emergency rescue plans are active.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateToTab("projects")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Analyzer</span>
            </button>
            
            <button
              onClick={() => onNavigateToTab("rescue")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-semibold text-xs shadow-lg shadow-rose-500/10 hover:shadow-rose-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>AI Rescue Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
        {[
          { label: "Total Projects", value: totalProjects, icon: FolderKanban, color: "text-slate-300", bg: "bg-slate-900/30", badge: null, isGoalsSlot: false },
          { label: "Completed", value: completedProjects, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", badge: "Done", isGoalsSlot: false },
          { label: "Active", value: activeProjects, icon: Activity, color: "text-[#06B6D4]", bg: "bg-[#06B6D4]/10", badge: "Live", isGoalsSlot: false },
          { label: "Overdue", value: overdueProjects, icon: Clock, color: "text-rose-400", bg: "bg-rose-500/10", badge: "Action", isGoalsSlot: false },
          { label: "Goals", value: "", icon: Target, color: "text-amber-400", bg: "bg-amber-500/10", badge: null, isGoalsSlot: true },
          { 
            label: isSelectedToday ? "Tasks Today" : "Tasks on " + selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }), 
            value: uncompletedDailyTasks.length, 
            icon: ListTodo, 
            color: "text-[#8B5CF6]", 
            bg: "bg-[#8B5CF6]/10", 
            badge: totalHoursToSpend > 0 ? formatStepTime(totalHoursToSpend) : "0h", 
            isGoalsSlot: false 
          }
        ].map((stat, idx) => {
          if (stat.isGoalsSlot) {
            const completedManualGoals = manualGoals.filter(g => g.isDone).length;
            return (
              <div key={idx} className="bg-[#1E293B] p-4 rounded-2xl border border-slate-700/50 shadow-sm flex flex-col justify-between min-h-[160px] h-full">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col text-left">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider leading-none">My Goals</span>
                    <span className="text-slate-500 text-[9px] font-mono leading-none mt-1">
                      {completedManualGoals}/{manualGoals.length} Done
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 max-h-[85px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {manualGoals.length > 0 ? (
                    manualGoals.map((g) => (
                      <div 
                        key={g.id} 
                        className="flex items-center justify-between gap-1.5 p-1 rounded hover:bg-slate-800/40 transition-colors group text-left"
                      >
                        <div 
                          onClick={() => onToggleManualGoal && onToggleManualGoal(g.id)}
                          className="flex items-start gap-1.5 cursor-pointer flex-1 min-w-0"
                        >
                          <button className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                            g.isDone 
                              ? "bg-indigo-500 border-indigo-500 text-white" 
                              : "border-slate-600 hover:border-indigo-400 text-transparent"
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </button>
                          <span className={`text-[10px] leading-tight select-none break-words min-w-0 flex-1 ${
                            g.isDone ? "text-slate-500 line-through" : "text-slate-300 group-hover:text-white"
                          }`}>
                            {g.text}
                          </span>
                        </div>
                        <button 
                          onClick={() => onDeleteManualGoal && onDeleteManualGoal(g.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 rounded transition-all shrink-0"
                          title="Delete Goal"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-slate-500 text-center py-2 italic leading-tight">
                      No manual goals set. Add one below!
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddGoalSubmit} className="mt-2.5 flex items-center gap-1">
                  <input
                    type="text"
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    placeholder="Add manual goal..."
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded-lg transition-colors shrink-0"
                    title="Add Goal"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </form>
              </div>
            );
          }

          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-[#1E293B] p-5 rounded-2xl border border-slate-700/50 shadow-sm flex flex-col justify-between min-h-[160px] h-full">
              <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wider text-left">{stat.label}</span>
                <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <div className="flex items-end justify-between mt-auto">
                <h3 className="text-3xl font-bold text-white font-display leading-none">{stat.value}</h3>
                {stat.badge && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    stat.label === "Completed" ? "text-emerald-400 bg-emerald-500/10" :
                    stat.label === "Active" ? "text-cyan-400 bg-cyan-500/10" :
                    stat.label === "Overdue" ? "text-rose-400 bg-rose-500/10" : "text-indigo-400 bg-indigo-500/10"
                  }`}>
                    {stat.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left side: Project Priorities & Critical Risks */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 border-slate-800/80 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-xl font-bold font-display text-white">Project Priorities & Critical Risks</h3>
              <p className="text-xs text-slate-400">High-risk timelines are animated with an emergency red glow boundary.</p>
            </div>
            <button 
              onClick={() => onNavigateToTab("projects")}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-semibold font-mono"
            >
              View All
            </button>
          </div>

          <div className="space-y-4">
            {(() => {
              const getRiskWeight = (p: Project) => {
                const risk = p.risk?.risk_level;
                if (risk === "High") return 3;
                if (risk === "Medium") return 2;
                if (risk === "Low") return 1;
                return 0;
              };
              const sorted = [...projects].filter((p) => !p.archived).sort((a, b) => getRiskWeight(b) - getRiskWeight(a));
              return sorted.slice(0, 4).map((project) => {
                const rescueStatus = checkRescueConditions(project, profile);
                const isHighRisk = project.risk?.risk_level === "High";
                const isRescueNeeded = rescueStatus.isNeeded;
                
                const riskColor = isRescueNeeded
                  ? "text-rose-400 bg-rose-500/10"
                  : isHighRisk 
                    ? "text-rose-400 bg-rose-500/10" 
                    : project.risk?.risk_level === "Medium" 
                      ? "text-amber-400 bg-amber-500/10" 
                      : "text-emerald-400 bg-emerald-500/10";
                
                const cardBorderClass = isRescueNeeded
                  ? "border-rose-500 bg-rose-950/10 shadow-[0_0_20px_rgba(244,63,94,0.18)] animate-[pulse_2.5s_infinite]"
                  : isHighRisk
                    ? "border-rose-500/80 bg-rose-500/5 shadow-[0_0_15px_rgba(244,63,94,0.12)] animate-[pulse_3s_infinite]"
                    : "border-slate-800/60 bg-slate-900/30 hover:border-slate-700/60 hover:bg-slate-900/50";

                return (
                  <div 
                    key={project.id}
                    onClick={() => {
                      if (isRescueNeeded && onNavigateToRescue) {
                        onNavigateToRescue(project.id);
                      } else {
                        onNavigateToTab("projects");
                      }
                    }}
                    className={`p-5 rounded-2xl transition-all cursor-pointer flex flex-col gap-4 border ${cardBorderClass}`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-3">
                          {/* Interactive risk status bullet */}
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            {(isHighRisk || isRescueNeeded) && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                              isRescueNeeded || isHighRisk ? "bg-rose-500" : project.risk?.risk_level === "Medium" ? "bg-amber-500" : "bg-emerald-500"
                            }`}></span>
                          </span>
                          
                          <span className="font-bold text-white text-base font-display leading-tight">{project.name}</span>
                          
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono uppercase shrink-0 ${riskColor}`}>
                            {isRescueNeeded ? "RESCUE ACTIVE" : `${project.risk?.risk_level || "No"} Risk`}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>Deadline: {project.deadline}</span>
                          </span>
                          <span>•</span>
                          <span>Workload: {project.analysis?.estimated_hours ? `${project.analysis.estimated_hours}h` : "N/A"}</span>
                          <span>•</span>
                          <span className="text-slate-500">Tasks: {project.plan?.steps?.length || 0}</span>
                        </div>
                      </div>

                      <div className="w-full sm:w-36 space-y-1.5 shrink-0">
                        <div className="flex justify-between text-[11px] font-mono text-slate-500">
                          <span>DELIVERY</span>
                          <span className="text-indigo-400 font-bold">{project.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              isRescueNeeded || isHighRisk ? "bg-gradient-to-r from-rose-500 to-indigo-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
                            }`}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Highly Polished Rescue Mode Callout */}
                    {isRescueNeeded && (
                      <div className="mt-1 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs w-full">
                        <div className="flex items-start gap-2">
                          <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                          <div className="space-y-0.5">
                            <span className="font-bold block">Automatic Rescue Mode Activated</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-md sm:max-w-lg md:max-w-xl">
                              Triggered: {rescueStatus.reasons[0]}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-rose-500/20 hover:bg-rose-500/30 px-2.5 py-1 rounded-lg text-white flex items-center gap-1 shrink-0 self-end sm:self-auto">
                          Open AI Rescue <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {projects.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center justify-center gap-4">
                <FolderKanban className="w-10 h-10 text-slate-700" />
                <p className="max-w-xs">No active projects found. Start by creating an AI-managed project!</p>
                <button
                  onClick={() => onNavigateToTab("projects-create")}
                  className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500/30 transition-all cursor-pointer"
                >
                  + Create Your First Project
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side: AI Task Scheduler / Calendar */}
        <div className="glass-card rounded-3xl p-6 border-slate-800/80 flex flex-col h-[480px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800/60 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-indigo-400 animate-bounce" />
              <div>
                <h3 className="text-base font-bold font-display text-white">AI Weekly Scheduler</h3>
                <p className="text-[10px] text-slate-500">Day-by-day sub-tasks checklist</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Previous/Next Week Navigation */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
                <button 
                  onClick={() => {
                    setWeekOffset(prev => prev - 7);
                    setSelectedDate(prev => {
                      const prevD = new Date(prev);
                      prevD.setDate(prev.getDate() - 7);
                      return prevD;
                    });
                  }}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {weekOffset !== 0 && (
                  <button 
                    onClick={() => {
                      setWeekOffset(0);
                      setSelectedDate(new Date());
                    }}
                    className="px-1.5 py-0.5 text-[8px] font-mono uppercase font-bold hover:bg-indigo-600/20 rounded text-indigo-400 transition-colors"
                    title="Jump to Today"
                  >
                    Today
                  </button>
                )}
                <button 
                  onClick={() => {
                    setWeekOffset(prev => prev + 7);
                    setSelectedDate(prev => {
                      const nextD = new Date(prev);
                      nextD.setDate(prev.getDate() + 7);
                      return nextD;
                    });
                  }}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  title="Next Week"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono font-bold border border-indigo-500/20 shrink-0">
                {dailyTasks.length} Active
              </span>
            </div>
          </div>

          {/* Weekday Selector Bar */}
          <div className="grid grid-cols-7 gap-1.5 pb-4 border-b border-slate-800/40 shrink-0">
            {weekDays.map((day, idx) => {
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const dayTasks = getTasksForDate(day);
              const hasTasks = dayTasks.length > 0;
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all relative ${
                    isSelected 
                      ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white ring-2 ring-indigo-500/30" 
                      : "bg-slate-900/40 hover:bg-slate-900/80 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="text-[9px] font-mono uppercase tracking-wider scale-90">
                    {getDayLabel(day)}
                  </span>
                  <span className="text-sm font-extrabold font-display leading-tight mt-0.5">
                    {day.getDate()}
                  </span>
                  
                  {/* Task indicator dot */}
                  {hasTasks && (
                    <span className={`absolute bottom-1 w-1 h-1 rounded-full ${
                      isSelected ? "bg-cyan-300" : "bg-indigo-500"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Checklist list for the selected date */}
          <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-2">
              Scheduled tasks for {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}:
            </div>

            {/* Case 2: Today's tasks are incomplete - show motivational alert with project deadlines */}
            {isSelectedToday && uncompletedDailyTasks.length > 0 && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-slate-900/60 border border-rose-500/20 space-y-2 mb-3 shadow-[0_2px_12px_rgba(244,63,94,0.03)] text-left">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 animate-pulse">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-bold text-rose-400 uppercase tracking-wider leading-none">Focus Required Today!</h4>
                    <p className="text-[10px] text-slate-300 italic truncate mt-0.5">
                      Success is the sum of small efforts. 💪 Finish your daily steps!
                    </p>
                  </div>
                </div>
                
                <div className="pt-1.5 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                  {(() => {
                    const uniqueProjectsInUncompleted = Array.from(new Set(uncompletedDailyTasks.map(t => t.projectId)));
                    return uniqueProjectsInUncompleted.map(projId => {
                      const proj = projects.find(p => p.id === projId);
                      if (!proj) return null;
                      return (
                        <div key={projId} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[9px]">
                          <span className="font-semibold text-slate-300 truncate max-w-[120px]">{proj.name}</span>
                          <span className="text-[8px] font-mono text-rose-400 font-semibold bg-rose-500/5 px-1 py-0.2 rounded">
                            Due: {proj.deadline}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Case 1: All today's tasks completed successfully - show encouragement and tomorrow's suggestions */}
            {isSelectedToday && dailyTasks.length > 0 && uncompletedDailyTasks.length === 0 && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-indigo-500/5 to-slate-900/60 border border-emerald-500/20 mb-3 shadow-[0_2px_12px_rgba(16,185,129,0.03)] text-left flex items-center gap-2">
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider leading-none">All Today's Tasks Completed! 🎉</h4>
                  <p className="text-[10px] text-slate-300 truncate mt-0.5">
                    Exceptional work! Tomorrow's optional tasks are highlighted below.
                  </p>
                </div>
              </div>
            )}
            
            {dailyTasks.map((task, idx) => {
              const proj = projects.find(p => p.id === task.projectId);
              const isDeadlineToday = proj && (
                new Date(proj.deadline).toDateString() === new Date().toDateString() ||
                new Date(proj.deadline).toDateString() === selectedDate.toDateString()
              );

              const riskColor = task.projectRisk === "High" ? "border-rose-500/30 bg-rose-500/5 text-rose-400" : "border-slate-800 bg-slate-900/20 text-slate-400";
              let borderHighlight = task.isSuggestedTomorrowTask
                ? "border-amber-500/40 bg-amber-500/[0.04] text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.06)]"
                : task.isNextDayTask 
                  ? "border-amber-500/30 bg-amber-500/[0.03] text-amber-400" 
                  : riskColor;

              if (isDeadlineToday && !task.isDone) {
                borderHighlight = "border-rose-500 bg-rose-500/10 text-rose-300 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-rose-500/40";
              }
              
              return (
                <div 
                  key={idx}
                  className={`p-3.5 rounded-xl border ${borderHighlight} flex items-start gap-3 transition-colors ${
                    task.isDone ? "opacity-60 bg-slate-950/20" : "hover:border-indigo-500/40"
                  }`}
                >
                  {/* Styled Checkbox */}
                  <button 
                    onClick={() => onToggleStep(task.projectId, task.stepName)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      task.isDone 
                        ? "bg-indigo-500 border-indigo-400 text-white" 
                        : "border-slate-700 hover:border-indigo-500 bg-slate-900"
                    }`}
                  >
                    {task.isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className="space-y-1 flex-1 min-w-0 text-left">
                    <p className={`text-xs font-semibold text-slate-200 leading-snug break-words flex flex-wrap items-center gap-1.5 ${
                      task.isDone ? "line-through text-slate-500" : ""
                    }`}>
                      <span>{task.stepName}</span>
                      {isDeadlineToday && !task.isDone && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                          🚨 Deadline Today
                        </span>
                      )}
                      {task.isSuggestedTomorrowTask && !isDeadlineToday && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          🚀 Tomorrow's Option
                        </span>
                      )}
                      {!task.isSuggestedTomorrowTask && task.isNextDayTask && !isDeadlineToday && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Next-Day Task
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-indigo-400">
                        {task.projectName}
                      </span>
                      <span>•</span>
                      <span className="font-mono">{formatStepTime(task.hours)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {dailyTasks.length === 0 && (
              <div className="text-center py-16 text-slate-500 text-xs h-full flex flex-col justify-center items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/20 animate-pulse" />
                <p className="font-medium text-slate-400">No scheduled sub-tasks today!</p>
                <p className="text-[10px] text-slate-600 max-w-[180px] mx-auto">
                  Take a breather or add new tasks inside your project detail panel.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
