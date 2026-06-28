import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, ProductivityHistory, Project } from "../types";
import { 
  User, 
  Briefcase, 
  Clock, 
  Activity, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  TrendingUp, 
  ListTodo, 
  Dumbbell, 
  ChevronRight,
  RefreshCw,
  Plus,
  Moon,
  Zap,
  Percent,
  History,
  Award
} from "lucide-react";

interface ProfileViewProps {
  userId: string;
  userName: string;
  userEmail: string;
  projects: Project[];
  onAddNotification: (title: string, message: string, type: "warning" | "info" | "success" | "danger", projectId: string) => void;
}

const DEFAULT_PROFILE: UserProfile = {
  occupation: "Freelancer",
  weekday_hours: 4,
  weekend_hours: 8,
  peak_productivity: "evening",
  stress_tolerance: "medium",
  multitasking: "medium",
  session_preference: "1 hr",
  buffer_preference: "medium",
  sleep_hours: 8,
  available_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  
  profession: "Freelancer",
  education: "Bachelor's Degree",
  skill_level: "Intermediate",
  years_of_experience: 3,
  uses_ai_tools: true,
  ai_tools: ["Gemini", "ChatGPT"],
  daily_work_hours: 4,
  weekend_work_hours: 8,
  focus_level: "High",
  previous_projects_completed: 12,
  task_completion_rate: 85,
  coding_experience: "Professional",
  technical_expertise: ["Website", "Backend", "APIs"],
  preferred_work_session: "1 hour",
  work_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  productivity_rating: 8
};

export default function ProfileView({ 
  userId, 
  userName, 
  userEmail, 
  projects,
  onAddNotification 
}: ProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<ProductivityHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load profile and history from Firestore /users/{userId}
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const userDocRef = doc(db, "users", userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.profile) {
            setProfile(data.profile);
          }
          if (data.history) {
            setHistory(data.history);
          }
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const userDocRef = doc(db, "users", userId);
      
      // Merge with existing doc if any
      const docSnap = await getDoc(userDocRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(userDocRef, {
        ...existingData,
        email: userEmail,
        displayName: userName,
        profile: profile,
        updatedAt: new Date().toISOString()
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      onAddNotification(
        "Productivity Profile Saved",
        "Your optional productivity profile is fully updated. AI task scheduling heuristics will now apply optimized buffers, session times, and peak productivity sessions.",
        "success",
        "system"
      );
    } catch (err) {
      console.error("Error saving user profile:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSeedHistory = async () => {
    const sampleHistory: ProductivityHistory[] = [
      {
        userId,
        projectName: "Redesign Landing Page",
        estimated_hours: 12,
        actual_hours: 10,
        predicted_completion: "2026-06-15",
        actual_completion: "2026-06-14",
        risk_prediction: "Low",
        actual_risk: "Low",
        completion_delay_days: 0,
        success: true,
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        userId,
        projectName: "Drizzle Schema Integration",
        estimated_hours: 8,
        actual_hours: 14,
        predicted_completion: "2026-06-18",
        actual_completion: "2026-06-20",
        risk_prediction: "Medium",
        actual_risk: "High",
        completion_delay_days: 2,
        success: false,
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        userId,
        projectName: "Write API Documentation",
        estimated_hours: 4,
        actual_hours: 3.5,
        predicted_completion: "2026-06-22",
        actual_completion: "2026-06-22",
        risk_prediction: "Low",
        actual_risk: "Low",
        completion_delay_days: 0,
        success: true,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    try {
      setSaving(true);
      const userDocRef = doc(db, "users", userId);
      const docSnap = await getDoc(userDocRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(userDocRef, {
        ...existingData,
        history: sampleHistory,
        updatedAt: new Date().toISOString()
      });

      setHistory(sampleHistory);
    } catch (err) {
      console.error("Error seeding history:", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    const currentDays = profile.available_days || [];
    let nextDays: string[];
    if (currentDays.includes(day)) {
      nextDays = currentDays.filter(d => d !== day);
    } else {
      nextDays = [...currentDays, day];
    }
    setProfile({ ...profile, available_days: nextDays, work_days: nextDays });
  };

  const toggleAiTool = (tool: string) => {
    const currentTools = profile.ai_tools || [];
    let nextTools: string[];
    if (currentTools.includes(tool)) {
      nextTools = currentTools.filter(t => t !== tool);
    } else {
      nextTools = [...currentTools, tool];
    }
    setProfile({ ...profile, ai_tools: nextTools, uses_ai_tools: nextTools.length > 0 });
  };

  const toggleExpertise = (exp: string) => {
    const currentExp = profile.technical_expertise || [];
    let nextExp: string[];
    if (currentExp.includes(exp)) {
      nextExp = currentExp.filter(e => e !== exp);
    } else {
      nextExp = [...currentExp, exp];
    }
    setProfile({ ...profile, technical_expertise: nextExp });
  };

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Helper calculation for multi-task capacity and scheduling analysis
  const activeProjects = projects.filter(p => !p.archived && p.progress < 100);
  const totalRequiredHours = activeProjects.reduce((sum, p) => sum + (p.analysis?.estimated_hours || 10) * (1 - p.progress / 100), 0);

  // Estimate availability in days left (min of active deadlines or 7 days)
  const daysRange = 7;
  const weekday_rate = profile.weekday_hours ?? 4;
  const weekend_rate = profile.weekend_hours ?? 8;
  const enabled_days = profile.available_days ?? daysOfWeek;

  let totalAvailableHoursNextWeek = 0;
  for (let i = 0; i < 7; i++) {
    const tempDate = new Date();
    tempDate.setDate(tempDate.getDate() + i);
    const dayName = tempDate.toLocaleDateString("en-US", { weekday: "long" });
    if (enabled_days.includes(dayName)) {
      const isWeekend = tempDate.getDay() === 0 || tempDate.getDay() === 6;
      totalAvailableHoursNextWeek += isWeekend ? weekend_rate : weekday_rate;
    }
  }

  // Feasibility Score next 7 days
  const feasibilityScore = totalRequiredHours > 0 
    ? (totalAvailableHoursNextWeek / totalRequiredHours) 
    : 1.5;

  let feasibilityStatus = "EASY";
  let feasibilityBadgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (feasibilityScore < 0.3) {
    feasibilityStatus = "IMPOSSIBLE";
    feasibilityBadgeColor = "text-rose-500 bg-rose-500/10 border-rose-500/30 animate-pulse";
  } else if (feasibilityScore < 0.7) {
    feasibilityStatus = "CRITICAL";
    feasibilityBadgeColor = "text-orange-400 bg-orange-500/10 border-orange-500/20";
  } else if (feasibilityScore < 1.0) {
    feasibilityStatus = "DIFFICULT";
    feasibilityBadgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  } else if (feasibilityScore < 1.5) {
    feasibilityStatus = "MANAGEABLE";
    feasibilityBadgeColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
  }

  // Calculate Productivity Score (Step 13)
  let productivityScore = 75; // average default
  if (history.length > 0) {
    const successCount = history.filter(h => h.success).length;
    const actualSum = history.reduce((sum, h) => sum + h.actual_hours, 0);
    const estSum = history.reduce((sum, h) => sum + h.estimated_hours, 0);
    
    // Formula combining timely completions (success rate) and speed efficiency
    const rawScore = (successCount / history.length) * 70 + Math.min(30, (estSum / (actualSum || 1)) * 30);
    productivityScore = Math.round(Math.min(100, Math.max(10, rawScore)));
  }

  let productivityLevel = "Average";
  let productivityColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (productivityScore >= 90) {
    productivityLevel = "Elite";
    productivityColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  } else if (productivityScore >= 75) {
    productivityLevel = "Strong";
    productivityColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
  } else if (productivityScore >= 60) {
    productivityLevel = "Average";
    productivityColor = "text-[#06B6D4] bg-[#06B6D4]/10 border-[#06B6D4]/20";
  } else if (productivityScore >= 40) {
    productivityLevel = "Weak";
    productivityColor = "text-orange-400 bg-orange-500/10 border-orange-500/20";
  } else {
    productivityLevel = "Critical";
    productivityColor = "text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse";
  }

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Loading Productivity Insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* View Header */}
      <div>
        <h2 className="text-3xl font-extrabold font-display tracking-tight text-white">Intelligent Productivity Center</h2>
        <p className="text-slate-400 text-sm">Configure working routines, run multi-project workload simulators, and audit historical performance logs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side (Col 2): Profile Editor Card */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveProfile} className="glass-card rounded-3xl p-6 md:p-8 border-slate-800/80 space-y-6 relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-3 border-b border-slate-800/60 pb-4">
              <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-display text-white">Daily Productivity Profile</h3>
                <p className="text-xs text-slate-400">Your optimized capacity values will drive the Advanced Scheduling calculations.</p>
              </div>
            </div>

            <div className="space-y-8">
              
              {/* Section 1: Professional Background */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/40 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>1. Professional Background</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Occupation/Profession */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Current Profession</label>
                    <input
                      type="text"
                      value={profile.profession || ""}
                      onChange={(e) => setProfile({ ...profile, profession: e.target.value, occupation: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                      placeholder="e.g. Software Engineer, Student, UX Designer"
                    />
                  </div>

                  {/* Education */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Education Level</label>
                    <select
                      value={profile.education || "Bachelor's Degree"}
                      onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="High School">High School</option>
                      <option value="Associate Degree">Associate Degree</option>
                      <option value="Bachelor's Degree">Bachelor's Degree</option>
                      <option value="Master's Degree">Master's Degree</option>
                      <option value="PhD">PhD / Doctorate</option>
                      <option value="Self-Taught / Other">Self-Taught / Other</option>
                    </select>
                  </div>

                  {/* Skill Level */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Overall Skill Level</label>
                    <div className="grid grid-cols-4 gap-2">
                      {["Beginner", "Intermediate", "Advanced", "Expert"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setProfile({ ...profile, skill_level: lvl })}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                            (profile.skill_level || "Intermediate") === lvl
                              ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Years of Experience */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Years of Experience</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={profile.years_of_experience !== undefined ? profile.years_of_experience : 3}
                      onChange={(e) => setProfile({ ...profile, years_of_experience: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Technical Skills & Expertise */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/40 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>2. Technical Skills & Expertise</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Coding Experience */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Coding Experience Level</label>
                    <select
                      value={profile.coding_experience || "Intermediate"}
                      onChange={(e) => setProfile({ ...profile, coding_experience: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="None">None (No Coding required)</option>
                      <option value="Beginner">Beginner (Can read basic code)</option>
                      <option value="Intermediate">Intermediate (Build projects with support)</option>
                      <option value="Professional">Professional (Produce production software)</option>
                    </select>
                  </div>

                  {/* Technical Expertise checklist */}
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono block">Domain Expertise Accents</label>
                    <span className="text-[10px] text-slate-500 mb-2 block">Select keywords representing domains you have high confidence/expertise in. Tasks matching these get personalized speed estimations.</span>
                    <div className="flex flex-wrap gap-2">
                      {["Website", "Backend", "Frontend", "APIs", "ML", "Data Analysis", "Regression", "Deep Learning", "UI/UX", "Graphics"].map((exp) => {
                        const isSelected = (profile.technical_expertise || []).includes(exp);
                        return (
                          <button
                            key={exp}
                            type="button"
                            onClick={() => toggleExpertise(exp)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              isSelected
                                ? "bg-indigo-500/20 border-indigo-400 text-indigo-300"
                                : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400"
                            }`}
                          >
                            {exp}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: AI Tool Acceleration */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/40 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>3. AI Companion Hub</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <div>
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono block">Integrate AI Tools for Acceleration</span>
                      <span className="text-[10px] text-slate-400">Enabling AI assistance accelerates tasks by 20% to 60% based on active tool counts.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, uses_ai_tools: !profile.uses_ai_tools })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold font-mono border transition-all ${
                        profile.uses_ai_tools
                          ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent"
                          : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}
                    >
                      {profile.uses_ai_tools ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  {profile.uses_ai_tools && (
                    <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Select AI Tools in your Workflow</label>
                      <div className="flex flex-wrap gap-2">
                        {["ChatGPT", "Gemini", "Claude", "Copilot", "Cursor"].map((tool) => {
                          const isSelected = (profile.ai_tools || []).includes(tool);
                          return (
                            <button
                              key={tool}
                              type="button"
                              onClick={() => toggleAiTool(tool)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                isSelected
                                  ? "bg-violet-500/20 border-violet-500 text-violet-300 shadow-md"
                                  : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400"
                              }`}
                            >
                              🚀 {tool}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Focus & Productivity Profile */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/40 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>4. Routines & Focus Mechanics</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Daily work hours capacity */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Weekday Hours Capacity</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={profile.weekday_hours !== undefined ? profile.weekday_hours : 4}
                      onChange={(e) => setProfile({ ...profile, weekday_hours: Number(e.target.value), daily_work_hours: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                      placeholder="e.g. 4"
                    />
                  </div>

                  {/* Weekend work hours capacity */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Weekend Hours Capacity</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={profile.weekend_hours !== undefined ? profile.weekend_hours : 8}
                      onChange={(e) => setProfile({ ...profile, weekend_hours: Number(e.target.value), weekend_work_hours: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                      placeholder="e.g. 8"
                    />
                  </div>

                  {/* Peak Productivity Time */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Peak Performance Time</label>
                    <select
                      value={profile.peak_productivity || "evening"}
                      onChange={(e) => setProfile({ ...profile, peak_productivity: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="morning">Morning (8 AM - 12 PM)</option>
                      <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                      <option value="evening">Evening (5 PM - 9 PM)</option>
                      <option value="night">Night (9 PM - 2 AM)</option>
                    </select>
                  </div>

                  {/* Sleep Hours */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Sleep Hours</label>
                    <select
                      value={profile.sleep_hours !== undefined ? profile.sleep_hours : 8}
                      onChange={(e) => setProfile({ ...profile, sleep_hours: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                    >
                      {[4, 5, 6, 7, 8, 9].map((h) => (
                        <option key={h} value={h}>{h} Hours</option>
                      ))}
                    </select>
                  </div>

                  {/* Focus Level */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Focus Level Rank</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Low", "Medium", "High"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setProfile({ ...profile, focus_level: lvl })}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                            (profile.focus_level || "Medium") === lvl
                              ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Productivity Rating Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Productivity Self Rating</label>
                      <span className="text-xs font-mono font-bold text-indigo-400">{profile.productivity_rating || 8}/10</span>
                    </div>
                    <div className="flex items-center gap-3 py-2">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={profile.productivity_rating || 8}
                        onChange={(e) => setProfile({ ...profile, productivity_rating: Number(e.target.value) })}
                        className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Stress Tolerance */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Stress Tolerance</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Low", "Medium", "High"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setProfile({ ...profile, stress_tolerance: lvl.toLowerCase() })}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                            (profile.stress_tolerance || "medium").toLowerCase() === lvl.toLowerCase()
                              ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Multitasking Ability */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Multitasking Ability</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Low", "Medium", "High"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setProfile({ ...profile, multitasking: lvl.toLowerCase() })}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                            (profile.multitasking || "medium").toLowerCase() === lvl.toLowerCase()
                              ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Session preference */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Preferred Session Length</label>
                    <select
                      value={profile.session_preference || "1 hr"}
                      onChange={(e) => setProfile({ ...profile, session_preference: e.target.value, preferred_work_session: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="25 min">25 min (Pomodoro)</option>
                      <option value="45 min">45 min</option>
                      <option value="1 hr">1 hour</option>
                      <option value="2 hr">2 hours</option>
                      <option value="4 hr">4 hours</option>
                    </select>
                  </div>

                  {/* Buffer preferences */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Scheduling Buffer Margin</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Low", "Medium", "High"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setProfile({ ...profile, buffer_preference: lvl.toLowerCase() })}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                            (profile.buffer_preference || "medium").toLowerCase() === lvl.toLowerCase()
                              ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400"
                          }`}
                        >
                          {lvl} {lvl === "Low" ? "(10%)" : lvl === "Medium" ? "(20%)" : "(30%)"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Historical Performance Stats */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/40 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>5. Project History Metrics</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Previous projects completed */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Previous Projects Completed</label>
                    <input
                      type="number"
                      min="0"
                      value={profile.previous_projects_completed !== undefined ? profile.previous_projects_completed : 12}
                      onChange={(e) => setProfile({ ...profile, previous_projects_completed: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Task completion rate */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Task Completion Rate</label>
                      <span className="text-xs font-mono font-bold text-indigo-400">{profile.task_completion_rate || 85}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={profile.task_completion_rate || 85}
                      onChange={(e) => setProfile({ ...profile, task_completion_rate: Number(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Weekly Available Days */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/40 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>6. Available Days of Week</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => {
                    const isAvailable = (profile.available_days || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isAvailable
                            ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md shadow-indigo-500/10"
                            : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400"
                        }`}
                      >
                        {isAvailable && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200 shrink-0" />}
                        <span>{day.substring(0, 3)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Form actions */}
            <div className="pt-4 border-t border-slate-800/40 flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Save Productivity Profile</span>
              </button>

              {saveSuccess && (
                <div className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-bounce">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Profile updated in cloud node!</span>
                </div>
              )}
            </div>

          </form>

          {/* Historical Logs List */}
          <div className="glass-card rounded-3xl p-6 md:p-8 border-slate-800/80 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold font-display text-white">Productivity History Logs</h3>
              </div>
              
              {history.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedHistory}
                  className="px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  Seed Logs
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-850 font-mono text-slate-500 uppercase">
                    <th className="py-3 px-2">Project</th>
                    <th className="py-3 px-2">Est. Hours</th>
                    <th className="py-3 px-2">Actual Hours</th>
                    <th className="py-3 px-2">Predicted Date</th>
                    <th className="py-3 px-2">Delay</th>
                    <th className="py-3 px-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {history.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/30">
                      <td className="py-3.5 px-2 font-semibold text-slate-100">{log.projectName}</td>
                      <td className="py-3.5 px-2 font-mono text-slate-400">{log.estimated_hours}h</td>
                      <td className="py-3.5 px-2 font-mono text-slate-400">{log.actual_hours}h</td>
                      <td className="py-3.5 px-2 font-mono text-slate-400">{log.predicted_completion}</td>
                      <td className={`py-3.5 px-2 font-mono ${log.completion_delay_days > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {log.completion_delay_days === 0 ? "None" : `+${log.completion_delay_days}d`}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                          log.success 
                            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" 
                            : "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                        }`}>
                          {log.success ? "Success" : "Failed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No historical productivity logs stored yet. Seed samples to view calculations.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Side (Col 1): Capacities & Insights Side Panel */}
        <div className="space-y-6">
          
          {/* Productivity Coaching Summary */}
          <div className="glass-card rounded-3xl p-6 border-slate-800/80 space-y-4">
            <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              <span>AI Coaching Status</span>
            </h3>

            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-xs text-slate-500 font-mono font-bold uppercase">Productivity Score</span>
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-slate-800 flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-white font-display leading-none">{productivityScore}</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider font-mono ${productivityColor}`}>
                {productivityLevel} Rank
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-400 leading-relaxed bg-slate-950/20 p-4 rounded-xl border border-slate-900">
              <span className="font-semibold text-slate-200 block mb-1">Coach Recommendation:</span>
              {productivityScore >= 90 ? (
                "You are executing projects at an Elite pace! Continue scheduling tasks directly with conservative buffers, and maintain current high-efficiency session loops."
              ) : productivityScore >= 75 ? (
                "Strong capability! Your average completion matches estimated timelines accurately. Consider introducing a 15% safety buffer for medium-sized projects."
              ) : (
                "Timeline risk detected. You have a few completed-late steps. Consider increasing weekday availability by 1h, selecting low multitasking, and adopting a 20% to 30% safety buffer on all new tasks."
              )}
            </div>
          </div>

          {/* Feasibility Simulator Card */}
          <div className="glass-card rounded-3xl p-6 border-slate-800/80 space-y-4">
            <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span>Capacity Simulator</span>
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Based on your weekday/weekend hours capacity, we estimate your total available commitment bandwidth.
            </p>

            <div className="space-y-3 font-mono text-xs">
              
              <div className="p-3.5 rounded-xl bg-slate-900/30 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avail. Bandwidth (Next 7 days)</span>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-xl font-bold text-slate-200">{totalAvailableHoursNextWeek} Hours</span>
                  <span className="text-xs text-slate-500">({profile.available_days?.length || 0} active days)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/30 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Required Load (Next 7 days)</span>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-xl font-bold text-slate-200">{Math.round(totalRequiredHours)} Hours</span>
                  <span className="text-xs text-slate-500">({activeProjects.length} active projects)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Feasibility Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${feasibilityBadgeColor}`}>
                    {feasibilityStatus}
                  </span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Feasibility Index:</span>
                  <span className="font-semibold text-slate-200">{(feasibilityScore).toFixed(2)}</span>
                </div>

                {feasibilityScore < 0.3 && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] text-rose-400 flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <span className="font-bold block">Impossible Load Detected!</span>
                      The total workload requires more hours than you have available. DeadlineAI recommends pruning low-priority tasks or expanding capacity!
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
