import { useState, useEffect, useRef } from "react";
import { Project } from "../types";
import { fetchWithRetry } from "../lib/fetchWithRetry";
import { 
  BrainCircuit, 
  Send, 
  Sparkles, 
  User, 
  FolderKanban, 
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Cpu
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}

interface ChatbotViewProps {
  projects: Project[];
}

export default function ChatbotView({ projects }: ChatbotViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: "Hello! I am your **DeadlineAI Advisor**. Select any project from the side panel to load its complete risk profile and timeline context, or just ask me anything about optimizing your development workflow!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find currently selected project
  const currentProject = projects.find(p => p.id === selectedProjectId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || inputMessage;
    if (!messageText.trim() || loading) return;

    if (!textToSend) {
      setInputMessage("");
    }

    const newUserMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      // Build history for the chat API
      const chatHistory = messages
        .filter(m => m.id !== "welcome")
        .map(m => ({
          role: m.role,
          text: m.text
        }));

      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history: chatHistory,
          projectContext: currentProject || null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to connect to AI Advisor");
      }

      const data = await response.json();
      const newAiMessage: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: "model",
        text: data.text || "I was unable to formulate a response. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, newAiMessage]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: "model",
        text: `⚠️ **Error:** ${err.message || "Failed to generate a reply. Please try again."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (promptText: string) => {
    handleSendMessage(promptText);
  };

  const suggestions = [
    { label: "Check bottlenecks", text: "What are the major bottlenecks and high-risk aspects of this project?", icon: AlertTriangle },
    { label: "Get modular tips", text: "Suggest modular development patterns and clean architectures to speed up delivery of this project.", icon: Cpu },
    { label: "Suggest rescue steps", text: "Give me 5 actionable rescue steps to ensure I hit the deadline with optimal quality.", icon: Lightbulb },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-10rem)] max-h-[800px] items-stretch">
      {/* Sidebar - Context Selector */}
      <div className="glass-card rounded-2xl p-5 border-slate-800/80 flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <FolderKanban className="w-5 h-5 text-[#06B6D4]" />
          <h3 className="font-bold text-white text-base font-display">Active Context</h3>
        </div>
        
        <p className="text-xs text-slate-400 mb-4">
          Select a project to load its deadline, priorities, and specific AI analysis into your chatbot discussion.
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <button
            onClick={() => setSelectedProjectId("")}
            className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
              selectedProjectId === "" 
                ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]" 
                : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300"
            }`}
          >
            <span>General Advisor (No Project)</span>
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          </button>

          {projects.map((proj) => {
            const isSelected = proj.id === selectedProjectId;
            return (
              <button
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                  isSelected 
                    ? "bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]" 
                    : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-start gap-2 w-full">
                  <span className={`text-xs font-bold font-display truncate ${isSelected ? "text-indigo-300" : "text-white"}`}>
                    {proj.name}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    proj.risk?.risk_level === "High" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {proj.risk?.risk_level || "Low"} Risk
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 w-full">
                  <span>Progress: {proj.progress}%</span>
                  <span className="font-mono text-indigo-400">{proj.deadline}</span>
                </div>
              </button>
            );
          })}

          {projects.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              No projects created yet. Let's make one on the Projects page!
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="lg:col-span-3 glass-card rounded-2xl border-slate-800/80 flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <BrainCircuit className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base font-display">AI Advisor Workspace</h3>
              <p className="text-xs text-slate-400">
                {currentProject ? `Discussing solutions for: ${currentProject.name}` : "Discussing general project strategies"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider uppercase">Active Agent</span>
          </div>
        </div>

        {/* Message Logs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => {
            const isModel = msg.role === "model";
            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${isModel ? "mr-auto" : "ml-auto flex-row-reverse"}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isModel 
                    ? "bg-slate-800 border border-slate-700 text-[#06B6D4]" 
                    : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                }`}>
                  {isModel ? <BrainCircuit className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className="space-y-1">
                  <div className={`p-3.5 rounded-2xl text-xs leading-relaxed border ${
                    isModel 
                      ? "bg-[#1E293B]/60 border-slate-800 text-slate-200 rounded-tl-none whitespace-pre-wrap" 
                      : "bg-indigo-500/10 border-indigo-500/20 text-indigo-100 rounded-tr-none"
                  }`}>
                    {msg.text}
                  </div>
                  <div className={`text-[9px] text-slate-500 font-mono ${!isModel && "text-right"}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-[85%] mr-auto">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-[#06B6D4] flex items-center justify-center shrink-0 animate-bounce">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div className="bg-[#1E293B]/60 border border-slate-800 text-slate-400 p-3.5 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="font-mono text-[10px] text-slate-500 ml-1">Advisor is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Buttons */}
        {currentProject && (
          <div className="px-6 py-2.5 border-t border-slate-800/60 bg-slate-900/10 shrink-0">
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider self-center mr-1">
                Suggestions:
              </span>
              {suggestions.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <button
                    key={idx}
                    disabled={loading}
                    onClick={() => handleSuggestionClick(s.text)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-[10.5px] font-semibold hover:text-white transition-all disabled:opacity-50"
                  >
                    <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-slate-800 bg-[#1E293B]/40 flex gap-3 items-center shrink-0">
          <input
            type="text"
            value={inputMessage}
            disabled={loading}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={
              currentProject 
                ? `Ask about project: "${currentProject.name}"...` 
                : "Ask for code advice, resource planning, or select a project..."
            }
            className="flex-1 bg-[#0F172A]/70 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={loading || !inputMessage.trim()}
            className="p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
