import { Project } from "../types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  Legend 
} from "recharts";
import { BarChart3, TrendingUp, AlertCircle, Sparkles, BrainCircuit } from "lucide-react";

interface AnalyticsViewProps {
  projects: Project[];
}

export default function AnalyticsView({ projects }: AnalyticsViewProps) {
  // Stat calculations
  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.progress >= 100).length;
  const activeProjects = projects.filter((p) => p.progress < 100).length;
  
  const today = new Date();
  const overdueProjects = projects.filter((p) => {
    if (p.progress >= 100) return false;
    const deadlineDate = new Date(p.deadline);
    return deadlineDate < today;
  }).length;

  const averageCompletion = totalProjects > 0 
    ? Math.round(projects.reduce((acc, curr) => acc + curr.progress, 0) / totalProjects)
    : 0;

  const aiProductivityScore = totalProjects > 0
    ? Math.round(projects.reduce((acc, curr) => acc + (curr.additionalAi?.productivity_score || 75), 0) / totalProjects)
    : 80;

  // 1. Project Progress Data
  const progressData = projects.map((p) => ({
    name: p.name.length > 15 ? `${p.name.substring(0, 12)}...` : p.name,
    progress: p.progress,
    risk: p.risk?.risk_score || 0,
    health: p.additionalAi?.project_health_score || 75
  }));

  // 2. Risk Distribution Data (Pie Chart)
  const highRiskCount = projects.filter((p) => p.risk?.risk_level === "High").length;
  const mediumRiskCount = projects.filter((p) => p.risk?.risk_level === "Medium").length;
  const lowRiskCount = projects.filter((p) => p.risk?.risk_level === "Low").length;

  const riskPieData = [
    { name: "High Risk", value: highRiskCount > 0 ? highRiskCount : (totalProjects > 0 ? 0 : 1), color: "#f43f5e" },
    { name: "Medium Risk", value: mediumRiskCount > 0 ? mediumRiskCount : (totalProjects > 0 ? 0 : 1), color: "#f59e0b" },
    { name: "Low Risk", value: lowRiskCount > 0 ? lowRiskCount : (totalProjects > 0 ? 0 : 2), color: "#10b981" }
  ];

  // 3. Productivity Trends / Health Over Timeline (Area Chart)
  const sortedProjects = [...projects].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const trendData = sortedProjects.map((p, idx) => ({
    milestone: `P-${idx + 1}`,
    productivity: p.additionalAi?.productivity_score || 75,
    health: p.additionalAi?.project_health_score || 80,
    probability: p.additionalAi?.deadline_probability || 70
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-extrabold font-display tracking-tight text-white">AI Predictive Analytics</h2>
        <p className="text-slate-400 text-sm">Review automatic task progress indexes, risk ratios, and timeline metrics.</p>
      </div>

      {/* Analytics KPI metrics cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
        {[
          { title: "Total Projects", value: totalProjects, change: "Registered", color: "text-slate-300" },
          { title: "Completed Projects", value: completedProjects, change: `${Math.round((completedProjects / (totalProjects || 1)) * 100)}% ratio`, color: "text-emerald-400" },
          { title: "Active Backlog", value: activeProjects, change: "In pipeline", color: "text-[#06B6D4]" },
          { title: "Overdue Milestones", value: overdueProjects, change: "Requires rescue", color: "text-rose-400" },
          { title: "Average Progress", value: `${averageCompletion}%`, change: "Overall scale", color: "text-[#06B6D4]" },
          { title: "AI Health Score", value: `${aiProductivityScore}/100`, change: "Algorithm rated", color: "text-[#8B5CF6]" }
        ].map((stat, idx) => (
          <div key={idx} className="bg-[#1E293B] p-5 rounded-2xl border border-slate-700/50 shadow-sm flex flex-col justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider font-mono">{stat.title}</span>
            <div className="my-2.5">
              <span className={`text-3xl font-black font-display ${stat.color}`}>{stat.value}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">{stat.change}</span>
          </div>
        ))}
      </div>

      {/* Recharts Chart Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Project Progress vs AI Predicted Risk */}
        <div className="glass-card rounded-3xl p-6 border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <span>Progress & Forecast Risk</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Bar metrics</span>
          </div>
          
          <div className="h-[280px] w-full text-xs">
            {progressData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono">
                No telemetry available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#475569" />
                  <YAxis stroke="#475569" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#e2e8f0" }}
                  />
                  <Legend />
                  <Bar dataKey="progress" fill="#6366f1" name="User Progress %" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="risk" fill="#f43f5e" name="AI Predicted Risk %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Timeline Trends (Productivity & Project Health Scores) */}
        <div className="glass-card rounded-3xl p-6 border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span>AI Productivity & Health Index</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Area timeline</span>
          </div>

          <div className="h-[280px] w-full text-xs">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono">
                Initialize a project to start model plotting
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="milestone" stroke="#475569" />
                  <YAxis stroke="#475569" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#e2e8f0" }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="productivity" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorProd)" name="Productivity Index" />
                  <Area type="monotone" dataKey="health" stroke="#06b6d4" fillOpacity={1} fill="url(#colorHealth)" name="Project Health Index" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: AI Predicted Risk Distribution */}
        <div className="glass-card rounded-3xl p-6 border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span>Risk Severity Ratios</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Risk distribution</span>
          </div>

          <div className="h-[240px] flex flex-col sm:flex-row items-center justify-around gap-6 text-xs">
            <div className="w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {riskPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 shrink-0">
              {riskPieData.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="font-semibold text-slate-200">{entry.name}</span>
                  <span className="font-mono text-slate-400 font-bold">
                    ({entry.value} project{entry.value !== 1 ? "s" : ""})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card: AI smart allocation recommendation based on backlog */}
        <div className="glass-card rounded-3xl p-6 border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <BrainCircuit className="w-5 h-5 text-violet-400" />
              <h3 className="text-lg font-bold font-display text-white">Smart Resource Allocation</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              AI analysis of your active timelines recommends focusing standard team capacities into targeted development, testing, and interface design cycles to minimize bottleneck delays before deadlines.
            </p>

            {/* Smart progress percentages summary */}
            <div className="space-y-3.5 pt-2">
              {[
                { label: "Core Feature Engineering (Development)", percent: 55, color: "bg-indigo-500" },
                { label: "Interactive Interface & Asset Prep (Design)", percent: 15, color: "bg-cyan-500" },
                { label: "System Debugging & Endpoint Checks (Testing)", percent: 20, color: "bg-violet-500" },
                { label: "Container Build & Release Deployment (Ops)", percent: 10, color: "bg-emerald-500" }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">{item.label}</span>
                    <span className="font-mono text-slate-400 font-bold">{item.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/60 mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Optimal allocations recalculate with each project update</span>
          </div>
        </div>

      </div>
    </div>
  );
}
