export interface TaskAnalysis {
  complexity: string; // "High" | "Medium" | "Low"
  estimated_hours: number;
  priority: string; // "High" | "Medium" | "Low"
  risk_level: string; // "High" | "Medium" | "Low"
  available_days: number;
  recommended_daily_hours: number;
  warning: string;
}

export interface PlanStep {
  step: string;
  hours: number;
  scheduled_time?: string;
  is_weekend_shifted?: boolean;
  buffer_applied_hours?: number;
}

export interface ProjectPlan {
  project_duration_days: number;
  total_estimated_hours: number;
  daily_required_hours: number;
  steps: PlanStep[];
}

export interface RiskPrediction {
  risk_score: number;
  risk_level: string; // "High" | "Medium" | "Low"
  reasons: string[];
}

export interface RescueReport {
  status: string;
  rescue_plan: string[];
  daily_target: string;
}

export interface SmartTimeAllocation {
  design_percent: number;
  development_percent: number;
  testing_percent: number;
  deployment_percent: number;
}

export interface AdditionalAiMetrics {
  daily_goals: string[];
  smart_time_allocation: SmartTimeAllocation;
  productivity_score: number;
  project_health_score: number;
  deadline_probability: number;
  weekly_progress_report: string;
  project_summary: string;
}

export interface NotificationItem {
  id: string;
  projectId: string;
  projectName: string;
  type: "warning" | "info" | "success" | "danger";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface UserProfile {
  occupation?: string;
  weekday_hours?: number;
  weekend_hours?: number;
  peak_productivity?: string;
  stress_tolerance?: string;
  multitasking?: string;
  session_preference?: string;
  buffer_preference?: string;
  sleep_hours?: number;
  available_days?: string[];
  
  // Personalized fields for DeadlineAI
  profession?: string;
  education?: string;
  skill_level?: string; // "Beginner" | "Intermediate" | "Advanced" | "Expert"
  years_of_experience?: number;
  uses_ai_tools?: boolean;
  ai_tools?: string[];
  daily_work_hours?: number;
  weekend_work_hours?: number;
  focus_level?: string; // "Low" | "Medium" | "High"
  previous_projects_completed?: number;
  task_completion_rate?: number;
  coding_experience?: string;
  technical_expertise?: string[];
  preferred_work_session?: string;
  work_days?: string[];
  productivity_rating?: number;
}

export interface ProductivityHistory {
  id?: string;
  userId: string;
  projectName: string;
  estimated_hours: number;
  actual_hours: number;
  predicted_completion: string;
  actual_completion: string;
  risk_prediction: string;
  actual_risk: string;
  completion_delay_days: number;
  success: boolean;
  timestamp: string;
}

export interface DeadlineAiResponse {
  task_domain: string;
  user_productivity_score: number;
  uses_personalized_estimation: boolean;
  uses_global_average: boolean;
  base_hours: number;
  final_estimated_hours: number;
  confidence: "high" | "medium" | "low" | string;
  reason: string;
  ai_time_saved_percentage: number;
  personal_speed_factor: number;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  deadline: string;
  priority: "High" | "Medium" | "Low" | "AI Generated";
  teamSize: number;
  progress: number;
  createdAt: string;
  analysis?: TaskAnalysis;
  plan?: ProjectPlan;
  risk?: RiskPrediction;
  rescue?: RescueReport;
  additionalAi?: AdditionalAiMetrics;
  deadlineAi?: DeadlineAiResponse;
  completedSteps?: string[];
  completedGoals?: string[];
  archived?: boolean;
  possible?: boolean;
  impossibleMessage?: string;
}
