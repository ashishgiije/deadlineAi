import { useState } from "react";
import { User, Bell, Shield, Sparkles, Database, CheckCircle2, AlertTriangle } from "lucide-react";

interface SettingsViewProps {
  userName: string;
  userEmail: string;
}

export default function SettingsView({ userName, userEmail }: SettingsViewProps) {
  const [allowAiAlerts, setAllowAiAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [rescueTriggerThreshold, setRescueTriggerThreshold] = useState("High");
  const [saved, setSaved] = useState(false);

  const handleSaveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-extrabold font-display tracking-tight text-white">System Settings</h2>
        <p className="text-slate-400 text-sm">Configure threshold alerts, model capabilities, and account profiles.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Details Card */}
        <div className="glass-card rounded-2xl p-6 border-slate-800/80 space-y-4">
          <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            <span>Developer Account Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 font-bold font-mono uppercase">Full Name</span>
              <p className="text-slate-200 text-sm font-semibold mt-1">{userName || "Alex Johnson"}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 font-bold font-mono uppercase">Email Address</span>
              <p className="text-slate-200 text-sm font-semibold mt-1">{userEmail || "alex@example.com"}</p>
            </div>
          </div>
        </div>

        {/* AI Notification Schedulers Card */}
        <div className="glass-card rounded-2xl p-6 border-slate-800/80 space-y-4">
          <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <span>AI Risk Notification Criteria</span>
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/20 border border-slate-800/50">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-slate-200 block">Immediate Risk Alerts</span>
                <span className="text-xs text-slate-400 block">Deliver real-time warnings whenever predicted risk exceeds critical levels.</span>
              </div>
              <input
                type="checkbox"
                checked={allowAiAlerts}
                onChange={(e) => setAllowAiAlerts(e.target.checked)}
                className="w-10 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/20 border border-slate-800/50">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-slate-200 block">Daily Digest Summary</span>
                <span className="text-xs text-slate-400 block">Compile automated morning checklists and progress targets into a unified feed.</span>
              </div>
              <input
                type="checkbox"
                checked={dailyDigest}
                onChange={(e) => setDailyDigest(e.target.checked)}
                className="w-10 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3.5 rounded-xl bg-slate-900/20 border border-slate-800/50">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-slate-200 block">AI Rescue Trigger Severity</span>
                <span className="text-xs text-slate-400 block">Set the default risk score classification required to suggest Rescue Mode.</span>
              </div>
              <select
                value={rescueTriggerThreshold}
                onChange={(e) => setRescueTriggerThreshold(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="High">High Risk &gt; 70%</option>
                <option value="Medium">Medium Risk &gt; 40%</option>
                <option value="Any">Any Critical Delay</option>
              </select>
            </div>
          </div>
        </div>

        {/* Database Credentials Card */}
        <div className="glass-card rounded-2xl p-6 border-slate-800/80 space-y-4">
          <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-400" />
            <span>Database & Cloud Node Metrics</span>
          </h3>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-2.5 font-mono text-slate-400">
            <div className="flex justify-between">
              <span>CLOUD RECTIFIER:</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
            <div className="flex justify-between">
              <span>FIRESTORE COLLECTION ROOT:</span>
              <span className="text-slate-200 font-semibold">projects, users, notifications</span>
            </div>
            <div className="flex justify-between">
              <span>ACTIVE MODEL:</span>
              <span className="text-indigo-400 font-semibold">gemini-2.5-flash</span>
            </div>
          </div>
        </div>

        {/* Actions panel */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Save Preferences</span>
          </button>

          {saved && (
            <div className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-bounce">
              <CheckCircle2 className="w-4 h-4" />
              <span>Preferences saved successfully!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
