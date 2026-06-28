import { LayoutDashboard, FolderKanban, MessageSquare, BarChart3, ShieldAlert, Settings, LogOut, Sparkles, Menu, X, User } from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  currentTab,
  onChangeTab,
  onLogout,
  userName,
  userEmail,
  isOpen,
  onToggle
}: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "profile", label: "Productivity Profile", icon: User },
    { id: "chatbot", label: "AI Advisor Chat", icon: MessageSquare },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "rescue", label: "AI Rescue Mode", icon: ShieldAlert, highlight: true },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          onClick={onToggle}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#1E293B] border-r border-slate-700 flex flex-col justify-between transition-transform duration-300 transform lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex flex-col flex-1 p-6">
          {/* Logo Section */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-lg flex items-center justify-center font-bold text-white shadow-lg shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white font-display">
                Deadline<span className="text-[#06B6D4]">AI</span>
              </h1>
            </div>
            <button 
              onClick={onToggle}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1.5 flex-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              
              let buttonStyle = "";
              if (isActive) {
                buttonStyle = "bg-slate-700/50 text-[#06B6D4] rounded-lg border border-slate-600/50";
              } else if (item.id === "rescue") {
                buttonStyle = "text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]";
              } else {
                buttonStyle = "text-slate-400 hover:text-white hover:bg-slate-800 transition-colors rounded-lg";
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeTab(item.id);
                    if (isOpen) onToggle(); // auto close on mobile select
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium transition-all group ${buttonStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 ${
                      isActive ? "text-[#06B6D4]" : item.id === "rescue" ? "text-rose-400" : "text-slate-400"
                    }`} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === "rescue" && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 animate-pulse uppercase tracking-wider">
                      Rescue
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-600 border border-slate-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName || "Alex Rivera"}</p>
              <p className="text-xs text-slate-500 truncate">Pro Plan</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-2 px-3 text-xs text-slate-400 hover:text-white border border-slate-700 rounded transition-colors"
          >
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
}
