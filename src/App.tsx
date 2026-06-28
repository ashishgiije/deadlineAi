import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, query, where, onSnapshot, addDoc, getDocs, doc, deleteDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { Project, NotificationItem } from "./types";
import { fetchWithRetry } from "./lib/fetchWithRetry";

// Import modular sub-components
import Sidebar from "./components/Sidebar";
import AuthView from "./components/AuthView";
import DashboardView from "./components/DashboardView";
import ProjectsView from "./components/ProjectsView";
import AnalyticsView from "./components/AnalyticsView";
import RescueView from "./components/RescueView";
import SettingsView from "./components/SettingsView";
import ChatbotView from "./components/ChatbotView";
import ProfileView from "./components/ProfileView";

import { 
  Menu, 
  Sparkles, 
  Bell, 
  Search, 
  User as UserIcon,
  BrainCircuit,
  LogOut,
  XCircle
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoOpenCreate, setAutoOpenCreate] = useState(false);
  
  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [completedProjectPopup, setCompletedProjectPopup] = useState<Project | null>(null);
  const [rescueProjectId, setRescueProjectId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [manualGoals, setManualGoals] = useState<any[]>([]);
  const [activeToasts, setActiveToasts] = useState<any[]>([]);
  const prevNotificationsRef = useRef<string[]>([]);

  // Monitor newly arrived notifications to show popup toasts
  useEffect(() => {
    if (user && notifications.length > 0) {
      const newNotifs = notifications.filter(n => !prevNotificationsRef.current.includes(n.id));
      
      // Only pop up toasts for newly added notifications, not the initial historic loading
      if (newNotifs.length > 0 && prevNotificationsRef.current.length > 0) {
        newNotifs.forEach(notif => {
          const toastId = `${notif.id}-${Date.now()}`;
          setActiveToasts(prev => [
            ...prev,
            {
              id: toastId,
              title: notif.title,
              message: notif.message,
              type: notif.type || 'info'
            }
          ]);
          
          // Auto remove toast after 6 seconds
          setTimeout(() => {
            setActiveToasts(prev => prev.filter(t => t.id !== toastId));
          }, 6000);
        });
      }
      prevNotificationsRef.current = notifications.map(n => n.id);
    } else if (notifications.length === 0) {
      prevNotificationsRef.current = [];
    }
  }, [notifications, user]);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Projects and Notifications when user logs in
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setNotifications([]);
      return;
    }

    setProjectsLoading(true);

    // Subscribe to projects collection for active user
    const projectsRef = collection(db, "projects");
    const qProjects = query(projectsRef, where("userId", "==", user.uid));
    const unsubscribeProjects = onSnapshot(qProjects, (snapshot) => {
      const projList: Project[] = [];
      snapshot.forEach((doc) => {
        projList.push({ id: doc.id, ...doc.data() } as Project);
      });
      // Sort projects by newest created date first
      projList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProjects(projList);
      setProjectsLoading(false);
    }, (error) => {
      console.error("Firestore projects sync error:", error);
      setProjectsLoading(false);
      handleFirestoreError(error, OperationType.LIST, "projects");
    });

    // Subscribe to notifications for active user
    const notifRef = collection(db, "notifications");
    const qNotif = query(notifRef, where("userId", "==", user.uid));
    const unsubscribeNotif = onSnapshot(qNotif, (snapshot) => {
      const notifList: NotificationItem[] = [];
      snapshot.forEach((doc) => {
        notifList.push({ id: doc.id, ...doc.data() } as NotificationItem);
      });
      // Sort notifications by newest first
      notifList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifList);
    }, (error) => {
      console.error("Firestore notifications sync error:", error);
      handleFirestoreError(error, OperationType.LIST, "notifications");
    });

    // Subscribe to optional user productivity profile
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profile) {
          setProfile(data.profile);
        } else {
          setProfile(null);
        }
        if (data.history) {
          setHistoryLogs(data.history);
        } else {
          setHistoryLogs([]);
        }
        if (data.manualGoals) {
          setManualGoals(data.manualGoals);
        } else {
          setManualGoals([]);
        }
      } else {
        setProfile(null);
        setHistoryLogs([]);
        setManualGoals([]);
      }
    }, (error) => {
      console.error("Firestore user profile sync error:", error);
    });

    return () => {
      unsubscribeProjects();
      unsubscribeNotif();
      unsubscribeUser();
    };
  }, [user]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentTab("dashboard");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Helper to append a custom notification
  const handleAddNotification = async (
    title: string,
    message: string,
    type: "warning" | "info" | "success" | "danger",
    projectId: string
  ) => {
    if (!user) return;
    try {
      const targetProj = projects.find(p => p.id === projectId);
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        projectId,
        projectName: targetProj?.name || "System Project",
        type,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.error("Error creating Firestore notification log:", err);
      handleFirestoreError(err, OperationType.CREATE, "notifications");
    }
  };

  const handleClearNotification = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleClearAllNotifications = async () => {
    if (!user) return;
    try {
      setNotifications([]);
      const q = query(collection(db, "notifications"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const batchPromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(batchPromises);
    } catch (err) {
      console.error("Error clearing all notifications:", err);
    }
  };

  const handleToggleStepFromDashboard = async (projectId: string, stepName: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
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

      const { doc, updateDoc } = await import("firebase/firestore");
      const ref = doc(db, "projects", proj.id);
      await updateDoc(ref, {
        completedSteps: newCompletedSteps,
        progress: safeProgress
      });

      // Show congratulations popup if completed!
      if (safeProgress >= 100) {
        setCompletedProjectPopup({
          ...proj,
          completedSteps: newCompletedSteps,
          progress: safeProgress
        });
      }

      // Re-trigger reanalysis with the subtask checklist formatted beautifully using the single consolidated analysis endpoint
      const taskPayload = `${proj.name} - ${proj.description}\nSubtasks:\n${proj.plan?.steps?.map(s => `- [${newCompletedSteps.includes(s.step) ? 'X' : ' '}] ${s.step} (${s.hours}h)`).join('\n')}`;

      fetchWithRetry("/api/consolidated-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: taskPayload,
          deadline: proj.deadline,
          progress: safeProgress,
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
      })
      .then(res => {
        if (!res.ok) throw new Error("Consolidated reanalysis endpoint failed");
        return res.json();
      })
      .then(async (consolidatedData) => {
        const isPossible = consolidatedData.possible !== false;

        const analysisData = consolidatedData.analysis || {
          complexity: proj.analysis?.complexity || "High",
          estimated_hours: proj.analysis?.estimated_hours || 10,
          priority: proj.priority || "High",
          risk_level: proj.analysis?.risk_level || "High",
          available_days: proj.analysis?.available_days || 1,
          recommended_daily_hours: proj.analysis?.recommended_daily_hours || 1,
          warning: consolidatedData.message || proj.analysis?.warning || "Impossible"
        };

        const riskData = consolidatedData.risk || {
          risk_score: proj.risk?.risk_score || 100,
          risk_level: proj.risk?.risk_level || "High",
          reasons: consolidatedData.message ? [consolidatedData.message] : (proj.risk?.reasons || ["Unknown risk"])
        };

        const additionalData = consolidatedData.additionalAi || {
          daily_goals: proj.additionalAi?.daily_goals || [],
          smart_time_allocation: proj.additionalAi?.smart_time_allocation || { design_percent: 25, development_percent: 50, testing_percent: 15, deployment_percent: 10 },
          productivity_score: proj.additionalAi?.productivity_score || 75,
          project_health_score: proj.additionalAi?.project_health_score || 75,
          deadline_probability: proj.additionalAi?.deadline_probability || 50,
          weekly_progress_report: proj.additionalAi?.weekly_progress_report || "Under re-evaluation",
          project_summary: consolidatedData.message || proj.additionalAi?.project_summary || proj.name
        };

        await updateDoc(ref, {
          analysis: analysisData,
          risk: riskData,
          additionalAi: additionalData,
          possible: isPossible,
          impossibleMessage: consolidatedData.message || ""
        });
      })
      .catch(err => console.error("Auto-reanalysis failed:", err));

    } catch (err) {
      console.error("Dashboard step completion error:", err);
    }
  };

  const handleToggleGoalFromDashboard = async (projectId: string, goalName: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const completedGoals = proj.completedGoals || [];
    let newCompletedGoals: string[];
    if (completedGoals.includes(goalName)) {
      newCompletedGoals = completedGoals.filter(g => g !== goalName);
    } else {
      newCompletedGoals = [...completedGoals, goalName];
    }
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "projects", projectId), {
        completedGoals: newCompletedGoals
      });
    } catch (err) {
      console.error("Error toggling goal completion from dashboard:", err);
    }
  };

  const handleAddManualGoal = async (text: string) => {
    if (!user) return;
    const newGoal = {
      id: Date.now().toString(),
      text,
      isDone: false,
      createdAt: new Date().toISOString()
    };
    const updated = [...manualGoals, newGoal];
    setManualGoals(updated);
    try {
      const { doc, setDoc, getDoc } = await import("firebase/firestore");
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      await setDoc(userDocRef, {
        ...existingData,
        manualGoals: updated,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding manual goal:", err);
    }
  };

  const handleToggleManualGoal = async (id: string) => {
    if (!user) return;
    const updated = manualGoals.map(g => g.id === id ? { ...g, isDone: !g.isDone } : g);
    setManualGoals(updated);
    try {
      const { doc, setDoc, getDoc } = await import("firebase/firestore");
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      await setDoc(userDocRef, {
        ...existingData,
        manualGoals: updated,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error toggling manual goal:", err);
    }
  };

  const handleDeleteManualGoal = async (id: string) => {
    if (!user) return;
    const updated = manualGoals.filter(g => g.id !== id);
    setManualGoals(updated);
    try {
      const { doc, setDoc, getDoc } = await import("firebase/firestore");
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      await setDoc(userDocRef, {
        ...existingData,
        manualGoals: updated,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error deleting manual goal:", err);
    }
  };

  const handleCompleteAndRemoveProject = async (projId: string) => {
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "projects", projId), {
        archived: true,
        progress: 100
      });
      handleAddNotification(
        "Project Completed & Archived! 🎉",
        "Amazing work! You reached 100% progress, and the project has been successfully completed and moved to your dashboard archive history.",
        "success",
        projId
      );
      setCompletedProjectPopup(null);
    } catch (err) {
      console.error("Error archiving completed project:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col justify-center items-center font-sans gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white animate-spin">
          <BrainCircuit className="w-8 h-8" />
        </div>
        <p className="text-slate-400 text-sm font-mono tracking-tight">Synchronizing DeadlineAI engine...</p>
      </div>
    );
  }

  // Not Authenticated -> Show Sign In / Register Card
  if (!user) {
    return <AuthView onAuthSuccess={() => setCurrentTab("dashboard")} />;
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex font-sans relative overflow-x-hidden">
      
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        onLogout={handleLogout}
        userName={user.displayName || "Developer"}
        userEmail={user.email || ""}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Header / Navigation Panel */}
        <header className="sticky top-0 z-30 h-16 bg-[#1E293B]/80 backdrop-blur-md border-b border-slate-700 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Search Projects input field in the top navbar */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-700 text-xs w-64 text-slate-400 focus-within:border-indigo-500 transition-colors">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects and tasks..." 
                className="bg-transparent border-none outline-none w-full text-slate-300 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell pill indicator */}
            <button 
              onClick={() => setNotificationsOpen(true)}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all relative shrink-0 border border-slate-700"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-[#0F172A]" />
              )}
            </button>

            {/* Premium Create Project redirection button */}
            <button
              onClick={() => {
                setCurrentTab("projects");
                setAutoOpenCreate(true);
              }}
              className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all cursor-pointer"
            >
              + Create Project
            </button>

            {/* User Profile display pill in top navbar */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-700">
              <div className="w-8 h-8 rounded-full bg-slate-600 border border-slate-500 flex items-center justify-center font-bold text-white text-xs">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-slate-300">
                {user.displayName || "Developer"}
              </span>
            </div>
          </div>
        </header>

        {/* Primary Page Canvas */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {projectsLoading && projects.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 font-sans">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Syncing pipeline reports...</p>
            </div>
          ) : (
            <>
              {currentTab === "dashboard" && (
                <DashboardView
                  projects={projects}
                  notifications={notifications}
                  onClearNotification={handleClearNotification}
                  onNavigateToTab={(tab) => {
                    if (tab === "projects-create") {
                      setCurrentTab("projects");
                      setAutoOpenCreate(true);
                    } else {
                      setCurrentTab(tab);
                    }
                  }}
                  onNavigateToRescue={(projectId) => {
                    setRescueProjectId(projectId);
                    setCurrentTab("rescue");
                  }}
                  userName={user.displayName || "Developer"}
                  onToggleStep={handleToggleStepFromDashboard}
                  profile={profile}
                  onToggleGoal={handleToggleGoalFromDashboard}
                  manualGoals={manualGoals}
                  onAddManualGoal={handleAddManualGoal}
                  onToggleManualGoal={handleToggleManualGoal}
                  onDeleteManualGoal={handleDeleteManualGoal}
                />
              )}

              {currentTab === "projects" && (
                <ProjectsView
                  projects={projects}
                  userId={user.uid}
                  onRefresh={() => {}}
                  onAddNotification={handleAddNotification}
                  onProjectCompleted={(p) => setCompletedProjectPopup(p)}
                  onNavigateToRescue={(projectId) => {
                    setRescueProjectId(projectId);
                    setCurrentTab("rescue");
                  }}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  profile={profile}
                  historyLogs={historyLogs}
                  autoOpenCreateProject={autoOpenCreate}
                  onResetAutoOpenCreateProject={() => setAutoOpenCreate(false)}
                />
              )}

              {currentTab === "profile" && (
                <ProfileView
                  userId={user.uid}
                  userName={user.displayName || "Developer"}
                  userEmail={user.email || ""}
                  projects={projects}
                  onAddNotification={handleAddNotification}
                />
              )}

              {currentTab === "analytics" && (
                <AnalyticsView projects={projects} />
              )}

              {currentTab === "chatbot" && (
                <ChatbotView projects={projects} />
              )}

              {currentTab === "rescue" && (
                <RescueView
                  projects={projects}
                  onRefresh={() => {}}
                  onAddNotification={handleAddNotification}
                  profile={profile}
                  initialSelectedProjId={rescueProjectId}
                  onResetInitialSelectedProjId={() => setRescueProjectId(null)}
                />
              )}

              {currentTab === "settings" && (
                <SettingsView
                  userName={user.displayName || "Developer"}
                  userEmail={user.email || ""}
                />
              )}
            </>
          )}
        </main>

        {/* Humility footer (Architecturally honest constraints - no margin telemetry clutter) */}
        <footer className="py-6 border-t border-slate-800/60 mt-12 bg-slate-950/20">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600 font-mono">
            <p>© 2026 DeadlineAI Platform Inc. All rights reserved.</p>
            <p className="flex items-center gap-1.5 text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500/30" />
              <span>Accelerating delivery timelines securely</span>
            </p>
          </div>
        </footer>

      </div>

      {/* Notifications Sidebar / Drawer Overlay */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setNotificationsOpen(false)}
          />
          <div className="relative w-full max-w-md h-full bg-[#1e293b] border-l border-slate-800 p-6 shadow-2xl flex flex-col z-50 animate-[slideIn_0.3s_ease-out]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold font-display text-white">AI Assistant Alerts</h3>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearAllNotifications}
                    className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 cursor-pointer transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button 
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 relative">
                  <button 
                    onClick={() => handleClearNotification(notif.id)}
                    className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${
                      notif.type === 'danger' ? 'bg-rose-500 animate-pulse' :
                      notif.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'
                    }`} />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{notif.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pr-6">{notif.message}</p>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No active logs. Everything is clear!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Congratulations Completion Pop-up Modal */}
      {completedProjectPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setCompletedProjectPopup(null)}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl p-8 text-center shadow-2xl shadow-indigo-500/20 z-50 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative space-y-6">
              <div className="inline-flex p-4 rounded-full bg-indigo-500/10 text-indigo-400 animate-bounce">
                <Sparkles className="w-12 h-12" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-3xl font-extrabold font-display text-white">Project Completed! 🎉</h3>
                <p className="text-indigo-300 font-bold text-lg font-display">"{completedProjectPopup.name}"</p>
              </div>

              <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                Congratulations on completing 100% of your project's sub-tasks! Your dedication, smart work, and strategic planning paid off beautifully.
              </p>

              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/80 max-w-sm mx-auto flex flex-col gap-1.5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Sub-tasks Done:</span>
                  <span className="font-bold text-indigo-400">{completedProjectPopup.plan?.steps?.length || 1} of {completedProjectPopup.plan?.steps?.length || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Time Saved:</span>
                  <span className="font-bold text-emerald-400">{completedProjectPopup.analysis?.estimated_hours || 0} Hours</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleCompleteAndRemoveProject(completedProjectPopup.id)}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
                >
                  Archive & Clear Project
                </button>
                <button
                  onClick={() => setCompletedProjectPopup(null)}
                  className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Keep in View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Animated Toast Popups Stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto w-full p-4 rounded-2xl border bg-slate-900/95 backdrop-blur-md shadow-2xl flex items-start gap-3 border-slate-800"
              style={{ boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)" }}
            >
              <div className="shrink-0 mt-0.5">
                <span className={`flex w-3 h-3 rounded-full ${
                  toast.type === 'danger' ? 'bg-rose-500 animate-pulse' :
                  toast.type === 'warning' ? 'bg-amber-500 animate-pulse' :
                  toast.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-0.5">{toast.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => setActiveToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="shrink-0 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
