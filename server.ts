import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini SDK with User-Agent and key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("Warning: GEMINI_API_KEY environment variable is not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "MOCK_KEY",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// A robust helper function to execute Gemini calls with retries and model fallbacks
async function callGemini(
  options: {
    model: string;
    contents: any;
    config?: any;
    fallbackModel?: string;
  },
  retries = 3,
  delayMs = 1000
): Promise<any> {
  let attempt = 0;
  let currentModel = options.model;
  
  while (attempt < retries) {
    try {
      console.log(`Gemini API: Calling ${currentModel} (Attempt ${attempt + 1}/${retries})`);
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: options.contents,
        config: options.config,
      });
      return response;
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || String(error);
      const isUnavailable = errorMessage.toLowerCase().includes("unavailable") || 
                            errorMessage.toLowerCase().includes("high demand") || 
                            errorMessage.toLowerCase().includes("503") ||
                            error?.status === 503 ||
                            error?.status === "UNAVAILABLE";

      const isQuotaExceeded = errorMessage.toLowerCase().includes("quota") || 
                              errorMessage.toLowerCase().includes("rate limit") ||
                              errorMessage.toLowerCase().includes("exhausted") ||
                              error?.status === 429;

      if ((isUnavailable || isQuotaExceeded) && options.fallbackModel && currentModel !== options.fallbackModel) {
        console.log(`Gemini call failed (attempt ${attempt}/${retries}) using model ${currentModel} due to quota/demand. Switching to fallback model: ${options.fallbackModel}`);
        currentModel = options.fallbackModel;
        // Reset or adjust attempt count slightly to allow fallback a fair trial
        attempt = Math.max(0, attempt - 1);
        continue;
      }
      
      if (attempt >= retries) {
        console.error(`Gemini call failed catastrophically after ${retries} attempts:`, error);
        throw error;
      }
      
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.log(`Gemini call failed (attempt ${attempt}/${retries}) using model ${currentModel}: ${errorMessage}. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

app.use(express.json());

function cleanAndParseJson(text: string | undefined): any {
  if (!text) return {};
  let cleaned = text.trim();
  
  // Extract JSON block if surrounded by conversational text
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  let endIdx = -1;
  if (lastBrace !== -1 && lastBracket !== -1) {
    endIdx = Math.max(lastBrace, lastBracket);
  } else if (lastBrace !== -1) {
    endIdx = lastBrace;
  } else if (lastBracket !== -1) {
    endIdx = lastBracket;
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  } else {
    // If no braces/brackets found, fall back to standard markdown block stripping
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
  }
  
  cleaned = cleaned.trim();

  // Escape unescaped control characters (like raw newlines, carriage returns, tabs) inside double quotes
  let inString = false;
  let escaped = false;
  let processed = "";
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '"' && !escaped) {
      inString = !inString;
      processed += char;
    } else if (char === '\\' && inString) {
      escaped = !escaped;
      processed += char;
    } else {
      escaped = false;
      if (inString) {
        if (char === '\n') {
          processed += '\\n';
        } else if (char === '\r') {
          processed += '\\r';
        } else if (char === '\t') {
          processed += '\\t';
        } else {
          processed += char;
        }
      } else {
        processed += char;
      }
    }
  }

  // Remove trailing commas before closing braces/brackets
  processed = processed.replace(/,\s*([\}\]])/g, "$1");

  try {
    return JSON.parse(processed);
  } catch (error) {
    console.error("Failed to parse cleaned JSON. Original:", text, "Processed:", processed, error);
    throw error;
  }
}

// DeadlineAI algorithm implementation
function calculateDeadlineAi(task: string, profile: any, historyLogs: any[], baseEstimatedHours: number) {
  // Step 1: Calculate productivity score from 0 to 100
  let score = 0;

  // Skill Level
  const skill = profile?.skill_level || "Intermediate";
  if (skill === "Beginner") score += 20;
  else if (skill === "Intermediate") score += 50;
  else if (skill === "Advanced") score += 75;
  else if (skill === "Expert") score += 90;

  // AI Usage
  const usesAi = profile?.uses_ai_tools !== false; // defaults to true
  if (usesAi) score += 20;

  // Experience Level
  const yearsExp = profile?.years_of_experience !== undefined ? Number(profile.years_of_experience) : 3;
  if (yearsExp <= 1) score += 5;
  else if (yearsExp <= 3) score += 15;
  else if (yearsExp <= 5) score += 25;
  else score += 35;

  // Completed projects
  const completedProjects = profile?.previous_projects_completed !== undefined ? Number(profile.previous_projects_completed) : 12;
  if (completedProjects <= 5) score += 5;
  else if (completedProjects <= 20) score += 15;
  else score += 25;

  // Task completion rate
  const compRate = profile?.task_completion_rate !== undefined ? Number(profile.task_completion_rate) : 85;
  if (compRate <= 50) score += 5;
  else if (compRate <= 70) score += 15;
  else if (compRate <= 90) score += 25;
  else score += 35;

  // Focus Level
  const focus = profile?.focus_level || "High";
  if (focus === "Low") score += 0;
  else if (focus === "Medium") score += 10;
  else if (focus === "High") score += 20;

  // Cap productivity score at 100
  const user_productivity_score = Math.min(100, score);

  // Step 2: Determine task domain
  let task_domain = "Software Development";
  const taskLower = task.toLowerCase();

  const domainKeywords: { [key: string]: string[] } = {
    "Machine Learning": ["machine learning", "ml", "neural network", "deep learning", "classifier", "nlp", "llm"],
    "Data Science": ["regression", "analytics", "data analysis", "pandas", "data science", "dataset", "dataframe"],
    "Academics": ["study", "homework", "exam", "thesis", "research paper", "essay", "academics", "class", "lecture"],
    "Business": ["pitch", "finance", "business plan", "investor", "marketing", "sales", "revenue", "budget"],
    "Design": ["ui/ux", "graphics", "wireframe", "figma", "photoshop", "design", "logo", "styleguide", "mockup"],
    "Content Creation": ["youtube", "video", "blog post", "social media", "instagram", "tiktok", "content creation", "podcast"],
    "Shopping": ["buy", "grocery", "shopping", "store", "purchase", "supermarket"],
    "Travel": ["flight", "hotel", "travel", "trip", "distance", "vacation", "booking"],
    "Health": ["hospital", "doctor", "medical", "dentist", "gym", "exercise", "workout", "health", "clinic"],
    "Household": ["cleaning", "wash", "vacuum", "kitchen", "household", "laundry", "chore"],
    "Construction": ["building", "construction", "renovation", "carpentry", "brick", "concrete"],
  };

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some(keyword => taskLower.includes(keyword))) {
      task_domain = domain;
      break;
    }
  }

  // Step 3 & 4: Check if within expertise
  const profession = String(profile?.profession || profile?.occupation || "Freelancer").toLowerCase();
  const technicalExpertise = (profile?.technical_expertise || []).map((e: string) => e.toLowerCase());

  let isExpertise = false;

  // Profession-based matches
  if (profession.includes("developer") || profession.includes("engineer") || profession.includes("programmer") || profession.includes("coder")) {
    if (task_domain === "Software Development" || task_domain === "Machine Learning" || task_domain === "Data Science") {
      isExpertise = true;
    }
  } else if (profession.includes("designer") || profession.includes("artist")) {
    if (task_domain === "Design" || task_domain === "Content Creation") {
      isExpertise = true;
    }
  } else if (profession.includes("scientist") || profession.includes("analyst")) {
    if (task_domain === "Data Science" || task_domain === "Machine Learning") {
      isExpertise = true;
    }
  } else if (profession.includes("student") || profession.includes("academic")) {
    if (task_domain === "Academics") {
      isExpertise = true;
    }
  } else if (profession.includes("manager") || profession.includes("owner") || profession.includes("founder") || profession.includes("business")) {
    if (task_domain === "Business") {
      isExpertise = true;
    }
  }

  // Keyword expertise matches
  if (!isExpertise) {
    if (technicalExpertise.some((exp: string) => taskLower.includes(exp))) {
      isExpertise = true;
    }
  }

  // Set uses_personalized_estimation and uses_global_average
  const uses_personalized_estimation = isExpertise;
  const uses_global_average = !isExpertise;

  // Step 4: Base hours for outside expertise
  let base_hours = baseEstimatedHours;
  if (uses_global_average) {
    if (task_domain === "Shopping") base_hours = 2;
    else if (task_domain === "Health" && taskLower.includes("gym")) base_hours = 1.5;
    else if (task_domain === "Health") base_hours = 3.5;
    else if (task_domain === "Travel") base_hours = 4;
    else if (task_domain === "Household") base_hours = 2.5;
    else if (task_domain === "Business" && taskLower.includes("bank")) base_hours = 2;
    else {
      // General fallbacks for other domains
      base_hours = 3;
    }
  }

  // Step 3 multiplier: productivity_multiplier
  // linear formula: 1.5 - (productivity_score / 100)
  const productivity_multiplier = 1.5 - (user_productivity_score / 100);

  // Step 5: AI Tool Acceleration
  let ai_multiplier = 1.0;
  let ai_time_saved_percentage = 0;
  if (usesAi) {
    const aiTools = profile?.ai_tools || [];
    const aiToolCount = aiTools.length;
    if (aiToolCount >= 4) {
      ai_multiplier = 0.40; // 60% reduction
      ai_time_saved_percentage = 60;
    } else if (aiToolCount >= 2) {
      ai_multiplier = 0.60; // 40% reduction
      ai_time_saved_percentage = 40;
    } else {
      ai_multiplier = 0.80; // 20% reduction
      ai_time_saved_percentage = 20;
    }
  }

  // Step 6: Learning System personal_speed_factor
  let personal_speed_factor = 1.0;
  if (historyLogs && historyLogs.length > 0) {
    let sumEstimated = 0;
    let sumActual = 0;
    let completedCount = 0;
    for (const log of historyLogs) {
      if (log.estimated_hours > 0 && log.actual_hours > 0) {
        sumEstimated += Number(log.estimated_hours);
        sumActual += Number(log.actual_hours);
        completedCount++;
      }
    }
    if (completedCount > 0 && sumEstimated > 0) {
      const calculatedFactor = sumActual / sumEstimated;
      // Bound personal_speed_factor between 0.3 and 3.0 to prevent extreme variations
      personal_speed_factor = parseFloat(Math.min(3.0, Math.max(0.3, calculatedFactor)).toFixed(2));
    }
  }

  // Step 7: Final Estimation
  // final_hours = base_hours × productivity_multiplier × ai_multiplier × personal_speed_factor
  let final_estimated_hours = base_hours * productivity_multiplier * ai_multiplier * personal_speed_factor;
  // Let's round to nearest 0.5 or 1 hour
  final_estimated_hours = parseFloat(Math.max(0.5, Math.round(final_estimated_hours * 2) / 2).toFixed(1));

  // Confidence assessment
  let confidence: "high" | "medium" | "low" = "medium";
  if (user_productivity_score > 75 && isExpertise && historyLogs.length >= 3) {
    confidence = "high";
  } else if (user_productivity_score < 40 || !isExpertise) {
    confidence = "low";
  }

  // Reason description
  let reason = `Estimated via DeadlineAI. Base time is ${base_hours}h. `;
  if (uses_personalized_estimation) {
    reason += `Calculated personalized timeline as task aligns with your expert background. `;
  } else {
    reason += `Used global average task duration index for '${task_domain}' task domain outside of your expert workspace. `;
  }
  reason += `Applied a productivity multiplier of ${productivity_multiplier.toFixed(2)}x (Score: ${user_productivity_score}), `;
  if (usesAi) {
    reason += `AI multiplier of ${ai_multiplier.toFixed(2)}x (${ai_time_saved_percentage}% time saved), `;
  }
  reason += `and a personal speed learning factor of ${personal_speed_factor.toFixed(2)}x.`;

  return {
    task_domain,
    user_productivity_score,
    uses_personalized_estimation,
    uses_global_average,
    base_hours,
    final_estimated_hours,
    confidence,
    reason,
    ai_time_saved_percentage,
    personal_speed_factor
  };
}

// API Endpoints for AI features

// 1. AI Task Analyzer
app.post("/api/analyze-task", async (req, res) => {
  try {
    const { task, deadline, progress } = req.body;
    if (!task || !deadline) {
      return res.status(400).json({ error: "Missing task or deadline" });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const progressText = progress !== undefined ? `Current Progress: ${progress}% (note that only ${100 - Number(progress)}% of the project's work remains, so please adjust the remaining workload and recommend daily hours based on this remaining portion of the task)` : "";
    const prompt = `Analyze task complexity, estimate workload in hours, and calculate daily recommended hours.
Task: ${task}
Deadline: ${deadline}
${progressText}
Current Date: ${todayStr}

Calculate carefully:
1. Estimate total realistic hours needed.
2. Calculate available days from current date (${todayStr}) to deadline (${deadline}).
3. Determine feasibility: if available days * 8 hours is less than estimated workload, generate a warning like: "Estimated \${estimated_hours} hours required but only \${available_hours} hours available."
4. CRITICAL RISK RULE: If the deadline date is today (${todayStr}) or has already passed, and the current progress is less than 100%, the risk_level MUST be strictly evaluated as "High" (and warning should alert that immediate action is needed today), even if the task is very small (like a 1-hour task), because there is zero remaining buffer time to complete it.`;

    const response = await callGemini({
      model: "gemini-3.5-flash",
      fallbackModel: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            complexity: { type: Type.STRING, description: "High, Medium, or Low" },
            estimated_hours: { type: Type.INTEGER, description: "Estimated total hours required to build this task" },
            priority: { type: Type.STRING, description: "High, Medium, or Low" },
            risk_level: { type: Type.STRING, description: "High, Medium, or Low" },
            available_days: { type: Type.INTEGER, description: "Available calendar days remaining" },
            recommended_daily_hours: { type: Type.INTEGER, description: "Daily recommended effort in hours" },
            warning: { type: Type.STRING, description: "Warning if time is insufficient, or empty string if sufficient" }
          },
          required: ["complexity", "estimated_hours", "priority", "risk_level", "available_days", "recommended_daily_hours", "warning"]
        }
      }
    });

    const data = cleanAndParseJson(response.text);
    res.json(data);
  } catch (error: any) {
    console.error("Error analyzing task, using programmatic fallback:", error);
    
    // Programmatic backup generator
    const { task, deadline, progress } = req.body;
    const cleanTask = String(task || "").split('\n')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    let available_days = 5;
    try {
      const diffTime = new Date(deadline).getTime() - new Date(todayStr).getTime();
      available_days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch (e) {}

    const progressNum = progress !== undefined ? Math.min(100, Math.max(0, Number(progress))) : 0;
    
    // Heuristically estimate initial hours based on the length or keywords of the description
    let estimated_hours = 24;
    const descLower = cleanTask.toLowerCase();
    if (descLower.includes("simple") || descLower.includes("easy") || descLower.includes("quick")) {
      estimated_hours = 8;
    } else if (descLower.includes("complex") || descLower.includes("large") || descLower.includes("heavy") || descLower.includes("database")) {
      estimated_hours = 40;
    } else if (cleanTask.length > 30) {
      estimated_hours = 32;
    }

    const remainingHours = Math.max(2, Math.round(estimated_hours * (1 - progressNum / 100)));
    const recommended_daily_hours = Math.max(1, Math.round(remainingHours / available_days));
    
    const capacity = available_days * 8;
    const isOverload = remainingHours > capacity;
    let risk_level = isOverload ? "High" : (remainingHours > capacity * 0.7 ? "Medium" : "Low");
    if (available_days <= 1 && progressNum < 100) {
      risk_level = "High";
    }
    const warning = isOverload 
      ? `Estimated ${remainingHours} hours remaining required but only ${capacity} hours available.` 
      : (available_days <= 1 && progressNum < 100 ? "Deadline is today or has passed! Immediate attention required." : "");

    res.json({
      complexity: estimated_hours > 30 ? "High" : (estimated_hours > 12 ? "Medium" : "Low"),
      estimated_hours,
      priority: isOverload ? "High" : "Medium",
      risk_level,
      available_days,
      recommended_daily_hours,
      warning,
      is_fallback: true
    });
  }
});

// 2. AI Project Planner
app.post("/api/generate-plan", async (req, res) => {
  try {
    const { task, deadline } = req.body;
    if (!task || !deadline) {
      return res.status(400).json({ error: "Missing task or deadline" });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const prompt = `Generate a realistic, practical project plan.
Task: ${task}
Deadline: ${deadline}
Current Date: ${todayStr}

Rules:
1. Never generate plans requiring more hours than actually available before the deadline (assume typical 8 hours work capacity per day).
2. Assign highly realistic, average developer time required (measured in hours) for each step/sub-task. Avoid assigning bloated, excessive, or overly conservative hours (e.g. typical modular steps should take 1 to 4 hours, and absolute maximum for any single big step is 8 hours, so that the team can execute them quickly and track granular progress).
3. If this is a large, complex, or major project (such as developing a website, building a full-stack mobile or web app, writing a comprehensive thesis, designing complex databases, setting up production systems, organizing an event, etc.), you MUST break it down into a highly comprehensive, granular, detailed set of sequential sub-tasks (usually 10 to 15 granular steps rather than generic 3 or 4 high-level steps). Ensure specific sub-tasks are created for code setups, individual route designs, component coding, DB schemas, unit testing, styling refinement, and deployment.
4. Create sequential plan steps with duration in hours.`;

    const response = await callGemini({
      model: "gemini-3.5-flash",
      fallbackModel: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            project_duration_days: { type: Type.INTEGER },
            total_estimated_hours: { type: Type.INTEGER },
            daily_required_hours: { type: Type.INTEGER },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.STRING },
                  hours: { type: Type.INTEGER }
                },
                required: ["step", "hours"]
              }
            }
          },
          required: ["project_duration_days", "total_estimated_hours", "daily_required_hours", "steps"]
        }
      }
    });

    const data = cleanAndParseJson(response.text);
    res.json(data);
  } catch (error: any) {
    console.error("Error generating plan, using programmatic fallback:", error);
    const { task, deadline } = req.body;
    const cleanTask = String(task || "").split('\n')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    let available_days = 5;
    try {
      const diffTime = new Date(deadline).getTime() - new Date(todayStr).getTime();
      available_days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch (e) {}

    // Heuristically estimate total hours
    let total_estimated_hours = 24;
    const descLower = cleanTask.toLowerCase();
    if (descLower.includes("simple") || descLower.includes("easy") || descLower.includes("quick")) {
      total_estimated_hours = 8;
    } else if (descLower.includes("complex") || descLower.includes("large") || descLower.includes("heavy") || descLower.includes("database")) {
      total_estimated_hours = 40;
    } else if (cleanTask.length > 30) {
      total_estimated_hours = 32;
    }

    const daily_required_hours = Math.max(1, Math.round(total_estimated_hours / available_days));

    // Construct high quality sequential steps
    const steps = [
      { step: "Research specifications and technical project planning", hours: Math.round(total_estimated_hours * 0.15) || 2 },
      { step: "Draft wireframes, layouts, and style structures", hours: Math.round(total_estimated_hours * 0.15) || 2 },
      { step: "Develop core functional logic, APIs, and state systems", hours: Math.round(total_estimated_hours * 0.4) || 6 },
      { step: "Integrate database operations and persistence routines", hours: Math.round(total_estimated_hours * 0.15) || 2 },
      { step: "Comprehensive quality testing, bugs remediation, and polishing", hours: Math.round(total_estimated_hours * 0.15) || 2 }
    ].filter(s => s.hours > 0);

    res.json({
      project_duration_days: available_days,
      total_estimated_hours,
      daily_required_hours,
      steps,
      is_fallback: true
    });
  }
});

// 3. AI Risk Prediction
app.post("/api/predict-risk", async (req, res) => {
  try {
    const { task, deadline, progress } = req.body;
    if (!task || !deadline) {
      return res.status(400).json({ error: "Missing task or deadline" });
    }

    const currentProgress = progress !== undefined ? Number(progress) : 0;
    const todayStr = new Date().toISOString().split('T')[0];

    const prompt = `Evaluate the risk level and risk score for the following project:
Task/Description: ${task}
Deadline: ${deadline}
Current Progress: ${currentProgress}%
Current Date: ${todayStr}

CRITICAL RULE FOR RISK CALCULATION:
Risk MUST NOT directly or simplistically depend on the progress % alone. You must evaluate risk based on the REMAINING WORKLOAD compared to the REMAINING TIME until the deadline.
Follow these steps to determine the risk:
1. Estimate the TOTAL realistic hours needed for the task based on its description (e.g., if it's a simple 4-hour task, or a large 40-hour project).
2. Calculate the Remaining Workload:
   Remaining Workload Hours = Total Estimated Hours * (1 - (Current Progress / 100))
3. Calculate the Available Days left between the Current Date (${todayStr}) and the Deadline (${deadline}).
4. Calculate the Remaining Capacity:
   Remaining Capacity Hours = Available Days * 8 hours/day (typical work capacity).
5. Compare Remaining Workload to Remaining Capacity:
   - If the deadline has already passed or is today, and progress is not 100%, the risk MUST be "High" / critical and the risk_score MUST be high (e.g., 75% to 100%), even if the task is small (like a 1-hour task) since it must be completed by today and there is zero buffer time remaining.
   - If the deadline is in the future, and the Remaining Workload can be easily completed within the remaining days (e.g., a 4-hour task with 5 days left is extremely safe), the risk MUST be "Low" and the risk_score MUST be very low (e.g., 5% to 25%), even if the progress is 0%.
   - If the Remaining Workload is tight or exceeds the available capacity (e.g., a 40-hour task with 2 days left), the risk is "High" or "Medium" and the risk_score should be high (70% - 100%).

Also consider qualitative factors like task complexity, vague requirements, or potential external dependencies, but always ground the core risk in the quantitative workload vs available time.

Predict a risk score from 0 (no risk) to 100 (critical risk) and risk level (Low, Medium, High). Provide concise bullet reasons.`;

    const response = await callGemini({
      model: "gemini-3.5-flash",
      fallbackModel: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_score: { type: Type.INTEGER },
            risk_level: { type: Type.STRING },
            reasons: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["risk_score", "risk_level", "reasons"]
        }
      }
    });

    const data = cleanAndParseJson(response.text);
    res.json(data);
  } catch (error: any) {
    console.error("Error predicting risk, using programmatic fallback:", error);
    const { task, deadline, progress } = req.body;
    const cleanTask = String(task || "").split('\n')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    let available_days = 5;
    try {
      const diffTime = new Date(deadline).getTime() - new Date(todayStr).getTime();
      available_days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch (e) {}

    const progressNum = progress !== undefined ? Math.min(100, Math.max(0, Number(progress))) : 0;
    
    // Heuristic total hours
    let totalEstimatedHours = 24;
    const descLower = cleanTask.toLowerCase();
    if (descLower.includes("simple") || descLower.includes("easy") || descLower.includes("quick")) {
      totalEstimatedHours = 8;
    } else if (descLower.includes("complex") || descLower.includes("large") || descLower.includes("heavy") || descLower.includes("database")) {
      totalEstimatedHours = 40;
    } else if (cleanTask.length > 30) {
      totalEstimatedHours = 32;
    }

    const remainingHours = Math.max(0, Math.round(totalEstimatedHours * (1 - progressNum / 100)));
    const capacity = available_days * 8;
    
    // Calculate risk score
    let risk_score = 10;
    let risk_level = "Low";
    if (progressNum >= 100) {
      risk_score = 0;
      risk_level = "Low";
    } else {
      const ratio = remainingHours / capacity;
      risk_score = Math.min(100, Math.max(10, Math.round(ratio * 60 + 15)));
      if (available_days <= 1) {
        // If deadline is today (or has passed) and progress is not 100%, risk MUST be High
        risk_score = Math.max(85, risk_score);
        risk_level = "High";
      } else if (risk_score >= 70) {
        risk_level = "High";
      } else if (risk_score >= 35) {
        risk_level = "Medium";
      }
    }

    const reasons = [
      `Remaining workload is estimated at ${remainingHours}h over ${available_days} available days.`,
      `Required daily commitment is approximately ${(remainingHours / available_days).toFixed(1)}h.`,
      `Heuristics analyzed risk as ${risk_level} (${risk_score}%) under temporary high-demand AI fallback.`
    ];

    res.json({
      risk_score,
      risk_level,
      reasons,
      is_fallback: true
    });
  }
});

// 4. AI Rescue Mode
app.post("/api/rescue-mode", async (req, res) => {
  try {
    const { task, deadline, progress } = req.body;
    if (!task || !deadline) {
      return res.status(400).json({ error: "Missing task or deadline" });
    }

    const prompt = `Generate an immediate, step-by-step emergency rescue schedule to complete this task on time.
Task: ${task}
Deadline: ${deadline}
Current Progress: ${progress}%
Current Date: ${new Date().toISOString().split('T')[0]}

Determine if project status is behind schedule and offer practical, daily actions/milestones to rescue it before the deadline.
Additionally, you MUST recommend specific, advanced AI models and coding tools that the team can use to dramatically accelerate their pace (such as Gemini 1.5 Pro or Gemini 2.0 Flash for multi-modal reasoning, GitHub Copilot or Cursor for lightning-fast auto-completions, v0 or Bolt.new for rapid UI prototyping, or DeepSeek for deep logical checks). Integrate these AI suggestions directly into your concrete rescue steps so they know exactly which tools to leverage!`;

    const response = await callGemini({
      model: "gemini-3.5-flash",
      fallbackModel: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: "Behind Schedule, On Track, or Critical Rescue" },
            rescue_plan: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            daily_target: { type: Type.STRING, description: "e.g. 6 hours/day" }
          },
          required: ["status", "rescue_plan", "daily_target"]
        }
      }
    });

    const data = cleanAndParseJson(response.text);
    res.json(data);
  } catch (error: any) {
    console.error("Error in rescue mode, using programmatic fallback:", error);
    const { task, deadline, progress } = req.body;
    const cleanTask = String(task || "").split('\n')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    let available_days = 5;
    try {
      const diffTime = new Date(deadline).getTime() - new Date(todayStr).getTime();
      available_days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch (e) {}

    const progressNum = progress !== undefined ? Math.min(100, Math.max(0, Number(progress))) : 0;
    const status = (progressNum < 20 && available_days < 3) ? "Critical Rescue" : "Behind Schedule";
    
    const rescue_plan = [
      "Leverage Gemini 1.5 Pro & Cursor for lightning-fast backend code drafting and component structuring.",
      "De-prioritize secondary design assets and align immediately on core features with v0.dev UI prototyping.",
      "Consolidate daily developers sprint using GitHub Copilot to automate boilerplate code and focus solely on high-impact checklist subtasks.",
      "Conduct continuous peer checks and use Gemini Flash to explain and refactor complex logic quickly to eliminate deployment latency risks."
    ];

    res.json({
      status,
      rescue_plan,
      daily_target: `${Math.max(4, Math.round((24 * (1 - progressNum / 100)) / available_days))} hours/day`,
      is_fallback: true
    });
  }
});

// 5. Additional AI Features
app.post("/api/additional-ai", async (req, res) => {
  try {
    const { task, deadline, progress, priority } = req.body;
    if (!task || !deadline) {
      return res.status(400).json({ error: "Missing task or deadline" });
    }

    const prompt = `Generate secondary AI parameters for project deadline and risk intelligence:
Task: ${task}
Deadline: ${deadline}
Current Progress: ${progress}%
Priority: ${priority || "Medium"}
Current Date: ${new Date().toISOString().split('T')[0]}

Please generate:
- 3 small actionable daily goals for today.
- A smart category/milestone percentage time allocation.
- Productivity score (0-100) based on urgency.
- Project health score (0-100) based on progress and time left.
- Deadline probability predictor (0-100% chance of completion).
- Short weekly progress report.
- One-sentence dynamic project summary.`;

    const response = await callGemini({
      model: "gemini-3.5-flash",
      fallbackModel: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            daily_goals: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            smart_time_allocation: {
              type: Type.OBJECT,
              properties: {
                design_percent: { type: Type.INTEGER },
                development_percent: { type: Type.INTEGER },
                testing_percent: { type: Type.INTEGER },
                deployment_percent: { type: Type.INTEGER }
              },
              required: ["design_percent", "development_percent", "testing_percent", "deployment_percent"]
            },
            productivity_score: { type: Type.INTEGER },
            project_health_score: { type: Type.INTEGER },
            deadline_probability: { type: Type.INTEGER },
            weekly_progress_report: { type: Type.STRING },
            project_summary: { type: Type.STRING }
          },
          required: ["daily_goals", "smart_time_allocation", "productivity_score", "project_health_score", "deadline_probability", "weekly_progress_report", "project_summary"]
        }
      }
    });

    const data = cleanAndParseJson(response.text);
    res.json(data);
  } catch (error: any) {
    console.error("Error in additional AI metrics, using programmatic fallback:", error);
    const { task, deadline, progress, priority } = req.body;
    const cleanTask = String(task || "").split('\n')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    let available_days = 5;
    try {
      const diffTime = new Date(deadline).getTime() - new Date(todayStr).getTime();
      available_days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch (e) {}

    const progressNum = progress !== undefined ? Math.min(100, Math.max(0, Number(progress))) : 0;
    
    // Heuristic total hours
    let totalEstimatedHours = 24;
    const descLower = cleanTask.toLowerCase();
    if (descLower.includes("simple") || descLower.includes("easy") || descLower.includes("quick")) {
      totalEstimatedHours = 8;
    } else if (descLower.includes("complex") || descLower.includes("large") || descLower.includes("heavy") || descLower.includes("database")) {
      totalEstimatedHours = 40;
    }

    const remainingHours = Math.max(0, Math.round(totalEstimatedHours * (1 - progressNum / 100)));
    const capacity = available_days * 8;
    
    const workloadRatio = remainingHours / (capacity || 8);
    const deadline_probability = progressNum >= 100 ? 100 : Math.min(99, Math.max(5, Math.round(100 - workloadRatio * 45)));
    const productivity_score = Math.min(100, Math.max(30, Math.round(60 + (progressNum * 0.4))));
    const project_health_score = progressNum >= 100 ? 100 : Math.min(100, Math.max(10, Math.round(progressNum * 0.5 + (1 - workloadRatio) * 50)));

    const daily_goals = [
      `Review spec requirements & plan sub-tasks for ${cleanTask.substring(0, 30)}`,
      "Write clean, modular code with logical state checkpoints",
      "Run targeted validation tests to check UI responsivity"
    ];

    res.json({
      daily_goals,
      smart_time_allocation: {
        design_percent: 15,
        development_percent: 55,
        testing_percent: 20,
        deployment_percent: 10
      },
      productivity_score,
      project_health_score,
      deadline_probability,
      weekly_progress_report: `Development is currently at ${progressNum}% completion. Key milestones are being pursued diligently.`,
      project_summary: `Durable schedule tracking for '${cleanTask.substring(0, 50)}' with deadline scheduled for ${deadline}.`,
      is_fallback: true
    });
  }
});

interface ProfileInfo {
  occupation: string;
  weekday_hours: number;
  weekend_hours: number;
  peak_productivity: string;
  stress_tolerance: string;
  multitasking: string;
  buffer_preference: string;
  sleep_hours: number;
  available_days: string[];
}

interface WorkingDay {
  dateStr: string;
  dateKey: string;
  dayOfWeek: string;
  isWeekend: boolean;
  capacity: number;
  remainingCapacity: number;
}

function getWorkingDays(todayStr: string, deadlineStr: string, p: ProfileInfo, otherProjects?: any[]): WorkingDay[] {
  const workingDays: WorkingDay[] = [];
  const start = new Date(todayStr);
  const end = new Date(deadlineStr);
  
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const current = new Date(start);
  
  let loopGuard = 0;
  while (current <= end && loopGuard < 120) {
    loopGuard++;
    const dayOfWeek = daysOfWeek[current.getDay()];
    if (p.available_days.includes(dayOfWeek)) {
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      const capacity = isWeekend ? p.weekend_hours : p.weekday_hours;
      
      const dateStr = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateKey = current.toISOString().split('T')[0];
      
      workingDays.push({
        dateStr,
        dateKey,
        dayOfWeek,
        isWeekend,
        capacity: capacity || 4,
        remainingCapacity: capacity || 4
      });
    }
    current.setDate(current.getDate() + 1);
  }
  
  if (workingDays.length === 0) {
    const today = new Date(todayStr);
    const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dateKey = today.toISOString().split('T')[0];
    workingDays.push({
      dateStr,
      dateKey,
      dayOfWeek: daysOfWeek[today.getDay()],
      isWeekend: today.getDay() === 0 || today.getDay() === 6,
      capacity: 4,
      remainingCapacity: 4
    });
  }
  
  // Factor in other active projects to reduce standard capacity dynamically
  if (otherProjects && otherProjects.length > 0) {
    otherProjects.forEach((op: any) => {
      const totalHours = op.total_estimated_hours || 40;
      const progressPercent = op.progress !== undefined ? op.progress : 0;
      const hoursLeft = Math.max(0, totalHours * (1 - progressPercent / 100));
      
      if (hoursLeft <= 0) return;
      
      const opStart = new Date(todayStr);
      const opEnd = new Date(op.deadline);
      opStart.setHours(0, 0, 0, 0);
      opEnd.setHours(0, 0, 0, 0);
      
      const opDays: { dateKey: string; capacity: number }[] = [];
      const opCurrent = new Date(opStart);
      let opGuard = 0;
      while (opCurrent <= opEnd && opGuard < 120) {
        opGuard++;
        const dow = daysOfWeek[opCurrent.getDay()];
        if (p.available_days.includes(dow)) {
          const isWe = opCurrent.getDay() === 0 || opCurrent.getDay() === 6;
          const cap = isWe ? p.weekend_hours : p.weekday_hours;
          opDays.push({
            dateKey: opCurrent.toISOString().split('T')[0],
            capacity: cap || 4
          });
        }
        opCurrent.setDate(opCurrent.getDate() + 1);
      }
      
      const opTotalCap = opDays.reduce((sum, d) => sum + d.capacity, 0);
      if (opTotalCap > 0) {
        opDays.forEach(od => {
          const proportion = od.capacity / opTotalCap;
          const allocatedHours = hoursLeft * proportion;
          
          const matchingDay = workingDays.find(wd => wd.dateKey === od.dateKey);
          if (matchingDay) {
            matchingDay.remainingCapacity = Math.max(0, parseFloat((matchingDay.remainingCapacity - allocatedHours).toFixed(1)));
          }
        });
      }
    });
  }
  
  return workingDays;
}

function scheduleSteps(
  steps: any[],
  workingDays: WorkingDay[],
  targetWorkingDaysCount: number,
  peakProductivity: string,
  totalRequiredHours: number
): any[] {
  const scheduledSteps: any[] = [];
  
  // Calculate total available remaining capacity
  const totalRemainingCapacity = workingDays.reduce((sum, d) => sum + d.remainingCapacity, 0);
  
  // If remaining capacity is less than required, scale up each day's capacity proportionally to fit totalRequiredHours perfectly.
  // This ensures subtasks are divided beautifully across all days rather than piled onto the deadline day!
  if (totalRequiredHours > totalRemainingCapacity || totalRemainingCapacity <= 0) {
    const scaleFactor = totalRemainingCapacity > 0 ? (totalRequiredHours / totalRemainingCapacity) : 1;
    workingDays.forEach(day => {
      if (totalRemainingCapacity > 0) {
        day.remainingCapacity = parseFloat((day.remainingCapacity * scaleFactor).toFixed(1));
        day.capacity = parseFloat((day.capacity * scaleFactor).toFixed(1));
      } else {
        const share = parseFloat((totalRequiredHours / workingDays.length).toFixed(1));
        day.remainingCapacity = share;
        day.capacity = share;
      }
    });
  }
  
  for (let i = 0; i < steps.length; i++) {
    const origStep = steps[i];
    let hoursRemaining = origStep.hours || 1;
    let sessionCount = 1;
    
    // Determine proportional preferred day index
    let preferredDayIdx = 0;
    if (workingDays.length > 1) {
      // Scale step index across target working days count
      preferredDayIdx = Math.floor((i / steps.length) * targetWorkingDaysCount);
      if (preferredDayIdx >= targetWorkingDaysCount) {
        preferredDayIdx = targetWorkingDaysCount - 1;
      }
    }
    
    let currentDayIdx = preferredDayIdx;
    
    while (hoursRemaining > 0) {
      // Find the first day with remaining capacity starting from currentDayIdx
      while (currentDayIdx < workingDays.length && workingDays[currentDayIdx].remainingCapacity <= 0) {
        currentDayIdx++;
      }
      
      // If no day from currentDayIdx onwards has capacity, look back from day 0 to find ANY day with capacity
      if (currentDayIdx >= workingDays.length) {
        currentDayIdx = 0;
        while (currentDayIdx < workingDays.length && workingDays[currentDayIdx].remainingCapacity <= 0) {
          currentDayIdx++;
        }
      }
      
      // If absolutely no day has capacity (e.g. all 0), allocate to the last day
      if (currentDayIdx >= workingDays.length) {
        const lastDay = workingDays[workingDays.length - 1];
        scheduledSteps.push({
          step: sessionCount > 1 ? `${origStep.step} (Session ${sessionCount})` : origStep.step,
          hours: parseFloat(hoursRemaining.toFixed(1)),
          scheduled_time: `${lastDay.dateStr} (overtime)`,
          is_weekend_shifted: lastDay.isWeekend,
          buffer_applied_hours: origStep.buffer_applied_hours || 0
        });
        break;
      }
      
      const currentDay = workingDays[currentDayIdx];
      const isBufferDay = currentDayIdx >= targetWorkingDaysCount;
      
      const allocHours = Math.min(hoursRemaining, currentDay.remainingCapacity);
      
      let timeOfDay = "morning";
      if (currentDay.remainingCapacity > currentDay.capacity * 0.6) {
        timeOfDay = peakProductivity === "morning" ? "morning (peak)" : "morning";
      } else if (currentDay.remainingCapacity > currentDay.capacity * 0.3) {
        timeOfDay = peakProductivity === "afternoon" ? "afternoon (peak)" : "afternoon";
      } else {
        timeOfDay = peakProductivity === "evening" ? "evening (peak)" : "evening";
      }
      
      const scheduledLabel = isBufferDay 
        ? `${currentDay.dateStr} (${timeOfDay} - Buffer)` 
        : `${currentDay.dateStr} (${timeOfDay})`;
      
      scheduledSteps.push({
        step: hoursRemaining > allocHours || sessionCount > 1 
          ? `${origStep.step} (Session ${sessionCount})` 
          : origStep.step,
        hours: parseFloat(allocHours.toFixed(1)),
        scheduled_time: scheduledLabel,
        is_weekend_shifted: currentDay.isWeekend,
        buffer_applied_hours: origStep.buffer_applied_hours || 0
      });
      
      currentDay.remainingCapacity = parseFloat((currentDay.remainingCapacity - allocHours).toFixed(1));
      hoursRemaining = parseFloat((hoursRemaining - allocHours).toFixed(1));
      
      if (hoursRemaining > 0) {
        sessionCount++;
        currentDayIdx++;
      }
    }
  }
  
  return scheduledSteps;
}

function normalizeAvailableDays(days: any): string[] {
  const standardDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const rawDays = days || [];
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    return standardDays;
  }
  
  const normalized = rawDays.map(d => String(d).trim().toLowerCase());
  const filtered = standardDays.filter(day => {
    const dayLower = day.toLowerCase();
    return normalized.some(nd => nd === dayLower || nd.startsWith(dayLower.substring(0, 3)));
  });
  
  return filtered.length > 0 ? filtered : standardDays;
}

// 5.5 Consolidated Analysis Endpoint to drastically reduce Gemini requests and eliminate quota 429 rate limit issues
app.post("/api/consolidated-analysis", async (req, res) => {
  try {
    const { task, deadline, progress, priority, includePlan, profile, historyLogs, otherProjects } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    // Default or user-provided profile
    const p = {
      occupation: profile?.occupation || "Freelancer",
      weekday_hours: profile?.weekday_hours !== undefined ? Number(profile.weekday_hours) : 4,
      weekend_hours: profile?.weekend_hours !== undefined ? Number(profile.weekend_hours) : 8,
      peak_productivity: profile?.peak_productivity || "evening",
      stress_tolerance: profile?.stress_tolerance || "medium",
      multitasking: profile?.multitasking || "medium",
      buffer_preference: profile?.buffer_preference || "medium",
      sleep_hours: profile?.sleep_hours !== undefined ? Number(profile.sleep_hours) : 8,
      available_days: normalizeAvailableDays(profile?.available_days || profile?.work_days)
    };

    let bufferPercent = 20;
    if (p.buffer_preference === "low") bufferPercent = 10;
    if (p.buffer_preference === "high") bufferPercent = 30;

    // Calculate available days and hours programmatically
    const today = new Date();
    today.setHours(0,0,0,0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(23,59,59,999);

    let available_days_count = 0;
    let available_hours = 0;
    let weekdays_count = 0;
    let weekends_count = 0;

    if (deadlineDate >= today) {
      const current = new Date(today);
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      while (current <= deadlineDate) {
        const dayName = daysOfWeek[current.getDay()];
        if (p.available_days.includes(dayName)) {
          available_days_count++;
          const isWeekend = current.getDay() === 0 || current.getDay() === 6;
          if (isWeekend) {
            weekends_count++;
            available_hours += p.weekend_hours;
          } else {
            weekdays_count++;
            available_hours += p.weekday_hours;
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    const prompt = `You are an expert project manager and Project Intelligence Copilot.
Analyze the following project and construct an optimized schedule:
- Name/Description: "${task}"
- Deadline: "${deadline}"
- Current Progress: ${progress !== undefined ? progress : 0}%
- Priority: "${priority || "Medium"}"
- Today's Date: "${todayStr}"

User Productivity Profile Context:
- Occupation: ${p.occupation}
- Peak Performance Time: ${p.peak_productivity}
- Weekday Working Hours: ${p.weekday_hours}h/day
- Weekend Working Hours: ${p.weekend_hours}h/day
- Active Work Days: ${p.available_days.join(", ")}
- Sleep Hours: ${p.sleep_hours}h
- Multitasking Ability: ${p.multitasking}
- Stress Tolerance: ${p.stress_tolerance}
- Buffer Applied preference: ${p.buffer_preference} (${bufferPercent}% buffer)

Calculated Available Bandwidth:
- Available Days until Deadline: ${available_days_count} days
- Total Working Capacity Available: ${available_hours} hours

Your scheduling engine must process this task using the following steps:

STEP 1: Analyze the task and determine required hours (e.g. 1-3 hours for tiny errands, 5-20 hours for medium tasks, 25-60+ hours for large software/construction projects).
STEP 2: Calculate Feasibility Score = (Available Hours: ${available_hours}) / (Required Hours).
STEP 3: Determine Feasibility Status:
- Score > 1.5: EASY
- Score > 1.0: MANAGEABLE
- Score > 0.7: DIFFICULT
- Score <= 0.7: CRITICAL (The workload is very tight, but still feasible by scheduling steps across available days and utilizing overtime/buffer time. Set "possible": true and proceed with schedule).
STEP 4: Detect physically/logically impossible/absurd tasks. If a task is physically/logically impossible in the timeframe (e.g., 'build a skyscraper today', 'learn piano in 10 minutes', 'travel to Mars in 2 days'), then return exactly the impossible format. Do NOT mark a regular real-world task (such as a 40 page written assignment of java, study, homework, software coding project, chores, etc.) as impossible simply because the user's registered daily hours are tight; instead, always return "possible": true and generate a complete subtask plan, marking it as high-risk so they get a valid structured schedule.

STEP 5: If possible, generate a smart scheduled plan:
- Add a safety buffer of ${bufferPercent}% to the required hours.
- Break tasks into subtasks:
  - Small (< 2h): Schedule directly (1 step/subtask).
  - Medium (2-20h): Split into 2-5 subtasks.
  - Large (> 20h): Generate Milestones, Subtasks, Dependencies, Buffers (usually 8-15 steps).
- Smart Scheduling Rules (CRITICAL FOR ADHERENCE):
  - Do NOT schedule all subtasks on the deadline date.
  - Create a realistic and consistent schedule based on the user's daily working capacity (${p.weekday_hours}h/day on weekdays, ${p.weekend_hours}h/day on weekends) and available days before the deadline.
  - Distribute subtasks evenly across all available days.
  - Respect the user's daily work limit strictly.
  - Schedule tasks as early as possible instead of postponing them to the last day.
  - Leave 10-20% buffer time before the deadline (do not plan anything on the last day or days if possible).
  - Break large tasks into smaller sessions across multiple days.
  - Maintain user consistency by assigning manageable workloads each day.
  - If the task cannot be completed within the available time and user capacity, mark it as "HIGH RISK" or "IMPOSSIBLE" instead of forcing a schedule.
  - Schedule heavy sub-tasks during the user's Peak Performance Time ("${p.peak_productivity}").
  - Weekend Optimization: If weekend capacity is higher, shift heavy tasks to Saturdays and Sundays.
- Rescue Mode: If Current Progress (${progress !== undefined ? progress : 0}%) is less than expected progress given the days elapsed, activate "rescue_mode_active": true and specify rescue actions (e.g. "reduce scope", "compress schedule").

You must analyze this project and return a single consolidated JSON object containing:
If impossible, return:
{
  "possible": false,
  "risk": "IMPOSSIBLE",
  "completion_probability": 0,
  "message": "This task cannot physically be completed under the current constraints."
}

If possible, return:
{
  "possible": true,
  "analysis": {
     "complexity": "High" | "Medium" | "Low",
     "estimated_hours": number,
     "priority": "High" | "Medium" | "Low",
     "risk_level": "High" | "Medium" | "Low",
     "category": string,
     "dependencies": string[],
     "available_days": number,
     "recommended_daily_hours": number,
     "warning": string
  },
  "risk": {
     "risk_score": number (0 to 100),
     "risk_level": "Low" | "Medium" | "High",
     "reasons": string[]
  },
  "additionalAi": {
     "daily_goals": string[],
     "smart_time_allocation": { "design_percent": number, "development_percent": number, "testing_percent": number, "deployment_percent": number },
     "productivity_score": number,
     "project_health_score": number,
     "deadline_probability": number,
     "weekly_progress_report": string,
     "project_summary": string
  },
  "plan": {
     "project_duration_days": number,
     "total_estimated_hours": number,
     "daily_required_hours": number,
     "steps": [
        {
          "step": string,
          "hours": number,
          "scheduled_time": string,
          "is_weekend_shifted": boolean,
          "buffer_applied_hours": number
        }
     ]
  },
  "rescue": {
     "rescue_mode_active": boolean,
     "actions": string[]
  }
}

Rules:
1. You must respond with valid raw JSON and absolutely nothing else. No markdown wrappers.
2. All keys and formats must match the specification exactly.`;

    const response = await callGemini({
      model: "gemini-3.5-flash",
      fallbackModel: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const data = cleanAndParseJson(response.text);

    // Apply DeadlineAI algorithm on top of the Gemini analysis if possible
    if (data && data.possible) {
      const baseEstimatedHours = data.analysis?.estimated_hours || 12;
      const dlAi = calculateDeadlineAi(task, profile, historyLogs || [], baseEstimatedHours);
      
      data.deadlineAi = dlAi;

      // Overwrite general estimation values with DeadlineAI output to make it official
      if (data.analysis) {
        data.analysis.estimated_hours = dlAi.final_estimated_hours;
      }
      if (data.plan) {
        data.plan.total_estimated_hours = dlAi.final_estimated_hours;

        // Scale individual step hours proportionally to sum exactly to dlAi.final_estimated_hours
        if (data.plan.steps && data.plan.steps.length > 0) {
          const originalSum = data.plan.steps.reduce((sum: number, step: any) => sum + (step.hours || 0), 0);
          if (originalSum > 0) {
            let runningSum = 0;
            data.plan.steps.forEach((step: any, idx: number) => {
              if (idx === data.plan.steps.length - 1) {
                step.hours = parseFloat(Math.max(0.5, dlAi.final_estimated_hours - runningSum).toFixed(1));
              } else {
                const proportional = (step.hours / originalSum) * dlAi.final_estimated_hours;
                const rounded = parseFloat(Math.max(0.5, Math.round(proportional * 2) / 2).toFixed(1));
                step.hours = rounded;
                runningSum += rounded;
              }
            });
          }
          
          // Programmatic Smart Scheduler for strict rule adherence
          const workingDays = getWorkingDays(todayStr, deadline, p, otherProjects);
          const bufferDaysCount = workingDays.length >= 4 ? Math.max(1, Math.round(workingDays.length * 0.15)) : 0;
          const targetWorkingDaysCount = Math.max(1, workingDays.length - bufferDaysCount);
          const totalCapacity = workingDays.reduce((sum, d) => sum + d.capacity, 0);
          const targetCapacity = workingDays.slice(0, targetWorkingDaysCount).reduce((sum, d) => sum + d.capacity, 0);

          const scheduled = scheduleSteps(data.plan.steps, workingDays, targetWorkingDaysCount, p.peak_productivity, dlAi.final_estimated_hours);
          data.plan.steps = scheduled;
          
          const finalSum = scheduled.reduce((sum, s) => sum + (s.hours || 0), 0);
          data.plan.total_estimated_hours = parseFloat(finalSum.toFixed(1));
          if (data.analysis) {
            data.analysis.estimated_hours = parseFloat(finalSum.toFixed(1));
          }

          if (dlAi.final_estimated_hours > totalCapacity) {
            // Task is impossible under user's working capacity
            data.risk = {
              risk_score: 100,
              risk_level: "High",
              reasons: [
                `Total required hours (${dlAi.final_estimated_hours}h) exceeds your entire available working capacity (${totalCapacity}h) before the deadline.`,
                `This project requires high intensity and overtime hours on scheduled days to complete.`
              ]
            };
            if (data.analysis) {
              data.analysis.risk_level = "High";
              data.analysis.warning = "HIGH RISK / OVERTIME REQUIRED: This workload exceeds your registered standard working hours capacity. You will need to work extra hours (overtime) to complete it on time.";
            }
          } else {
            const hasBufferSteps = scheduled.some(s => s.scheduled_time && s.scheduled_time.includes("Buffer"));
            if (hasBufferSteps || dlAi.final_estimated_hours > targetCapacity) {
              if (!data.risk) {
                data.risk = { risk_score: 75, risk_level: "High", reasons: [] };
              }
              data.risk.risk_level = "High";
              if (!data.risk.reasons.some((r: string) => r.includes("buffer"))) {
                data.risk.reasons.push("Workload is tight and requires scheduling subtasks into your 10-20% safety buffer before the deadline.");
              }
              if (data.analysis) {
                data.analysis.risk_level = "High";
                data.analysis.warning = "High Risk: Required hours schedule into safety buffer days.";
              }
            }
          }
        }
      }
    }

    res.json(data);
  } catch (error: any) {
    console.error("Error in consolidated analysis, using programmatic fallback:", error);
    // Programmatic backup generator
    const { task, deadline, progress, priority, includePlan, profile, historyLogs, otherProjects } = req.body;
    const cleanTask = String(task || "").split('\n')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    let available_days = 5;
    try {
      const diffTime = new Date(deadline).getTime() - new Date(todayStr).getTime();
      available_days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch (e) {}

    const progressNum = progress !== undefined ? Math.min(100, Math.max(0, Number(progress))) : 0;
    
    let totalEstimatedHours = 24;
    const descLower = cleanTask.toLowerCase();
    if (descLower.includes("simple") || descLower.includes("easy") || descLower.includes("quick")) {
      totalEstimatedHours = 8;
    } else if (descLower.includes("complex") || descLower.includes("large") || descLower.includes("heavy") || descLower.includes("database")) {
      totalEstimatedHours = 40;
    } else if (cleanTask.length > 30) {
      totalEstimatedHours = 32;
    }

    const dlAiFallback = calculateDeadlineAi(task, profile, historyLogs || [], totalEstimatedHours);
    totalEstimatedHours = dlAiFallback.final_estimated_hours;

    const remainingHours = Math.max(0, Math.round(totalEstimatedHours * (1 - progressNum / 100)));
    const capacity = available_days * 8;
    const isOverload = remainingHours > capacity;
    let risk_level = isOverload ? "High" : (remainingHours > capacity * 0.7 ? "Medium" : "Low");
    const warning = isOverload 
      ? `Estimated ${remainingHours} hours remaining required but only ${capacity} hours available.` 
      : "";

    let risk_score = 10;
    if (progressNum >= 100) {
      risk_score = 0;
      risk_level = "Low";
    } else {
      const ratio = remainingHours / (capacity || 8);
      risk_score = Math.min(100, Math.max(10, Math.round(ratio * 60 + 15)));
      if (available_days <= 1) {
        risk_score = Math.max(85, risk_score);
        risk_level = "High";
      }
    }

    const reasons = [
      `Remaining workload is estimated at ${remainingHours}h over ${available_days} available days.`,
      `Required daily commitment is approximately ${(remainingHours / available_days).toFixed(1)}h.`,
      `DeadlineAI evaluated a final prediction factor of ${dlAiFallback.personal_speed_factor}x.`
    ];

    const daily_goals = [
      `Review spec requirements & plan sub-tasks for ${cleanTask.substring(0, 30)}`,
      "Write clean, modular code with logical state checkpoints",
      "Run targeted validation tests to check UI responsivity"
    ];

    const workloadRatio = remainingHours / (capacity || 8);
    const deadline_probability = progressNum >= 100 ? 100 : Math.min(99, Math.max(5, Math.round(100 - workloadRatio * 45)));
    const productivity_score = Math.min(100, Math.max(30, Math.round(60 + (progressNum * 0.4))));
    const project_health_score = progressNum >= 100 ? 100 : Math.min(100, Math.max(10, Math.round(progressNum * 0.5 + (1 - workloadRatio) * 50)));

    const result: any = {
      possible: true,
      deadlineAi: dlAiFallback,
      analysis: {
        complexity: totalEstimatedHours > 30 ? "High" : (totalEstimatedHours > 12 ? "Medium" : "Low"),
        estimated_hours: totalEstimatedHours,
        priority: isOverload ? "High" : "Medium",
        risk_level,
        available_days,
        recommended_daily_hours: Math.max(1, Math.round(remainingHours / available_days)),
        warning
      },
      risk: {
        risk_score,
        risk_level,
        reasons
      },
      additionalAi: {
        daily_goals,
        smart_time_allocation: {
          design_percent: 15,
          development_percent: 55,
          testing_percent: 20,
          deployment_percent: 10
        },
        productivity_score,
        project_health_score,
        deadline_probability,
        weekly_progress_report: `Development is currently at ${progressNum}% completion. Key milestones are being pursued diligently.`,
        project_summary: `Durable schedule tracking for '${cleanTask.substring(0, 50)}' with deadline scheduled for ${deadline}.`
      },
      is_fallback: true
    };

    if (includePlan) {
      const pFallback = {
        occupation: profile?.occupation || "Freelancer",
        weekday_hours: profile?.weekday_hours !== undefined ? Number(profile.weekday_hours) : 4,
        weekend_hours: profile?.weekend_hours !== undefined ? Number(profile.weekend_hours) : 8,
        peak_productivity: profile?.peak_productivity || "evening",
        stress_tolerance: profile?.stress_tolerance || "medium",
        multitasking: profile?.multitasking || "medium",
        buffer_preference: profile?.buffer_preference || "medium",
        sleep_hours: profile?.sleep_hours !== undefined ? Number(profile.sleep_hours) : 8,
        available_days: normalizeAvailableDays(profile?.available_days || profile?.work_days)
      };

      const rawSteps = [
        { step: "Research specifications and technical project planning", hours: Math.round(totalEstimatedHours * 0.15) || 2, buffer_applied_hours: 0.5 },
        { step: "Draft wireframes, layouts, and style structures", hours: Math.round(totalEstimatedHours * 0.15) || 2, buffer_applied_hours: 0.5 },
        { step: "Develop core functional logic, APIs, and state systems", hours: Math.round(totalEstimatedHours * 0.4) || 6, buffer_applied_hours: 1 },
        { step: "Integrate database operations and persistence routines", hours: Math.round(totalEstimatedHours * 0.15) || 2, buffer_applied_hours: 0.5 },
        { step: "Comprehensive quality testing, bugs remediation, and polishing", hours: Math.round(totalEstimatedHours * 0.15) || 2, buffer_applied_hours: 0.5 }
      ].filter(s => s.hours > 0);

      // Scale hours proportionally to sum exactly to totalEstimatedHours
      const originalSum = rawSteps.reduce((sum: number, step: any) => sum + (step.hours || 0), 0);
      if (originalSum > 0) {
        let runningSum = 0;
        rawSteps.forEach((step: any, idx: number) => {
          if (idx === rawSteps.length - 1) {
            step.hours = parseFloat(Math.max(0.5, totalEstimatedHours - runningSum).toFixed(1));
          } else {
            const proportional = (step.hours / originalSum) * totalEstimatedHours;
            const rounded = parseFloat(Math.max(0.5, Math.round(proportional * 2) / 2).toFixed(1));
            step.hours = rounded;
            runningSum += rounded;
          }
        });
      }

      const workingDays = getWorkingDays(todayStr, deadline, pFallback, otherProjects);
      const bufferDaysCount = workingDays.length >= 4 ? Math.max(1, Math.round(workingDays.length * 0.15)) : 0;
      const targetWorkingDaysCount = Math.max(1, workingDays.length - bufferDaysCount);
      const totalCapacity = workingDays.reduce((sum, d) => sum + d.capacity, 0);
      const targetCapacity = workingDays.slice(0, targetWorkingDaysCount).reduce((sum, d) => sum + d.capacity, 0);

      if (totalEstimatedHours > totalCapacity) {
        result.risk = {
          risk_score: 100,
          risk_level: "High",
          reasons: [
            `Total required hours (${totalEstimatedHours}h) exceeds your entire standard available capacity (${totalCapacity}h) before the deadline.`,
            `This project requires high intensity and overtime hours on scheduled days to complete.`
          ]
        };
        result.analysis.risk_level = "High";
        result.analysis.warning = "HIGH RISK / OVERTIME REQUIRED: This workload exceeds your registered standard working hours capacity. You will need to work extra hours (overtime) to complete it on time.";
      }

      const scheduled = scheduleSteps(rawSteps, workingDays, targetWorkingDaysCount, pFallback.peak_productivity, totalEstimatedHours);

      result.plan = {
        project_duration_days: available_days,
        total_estimated_hours: totalEstimatedHours,
        daily_required_hours: Math.max(1, Math.round(totalEstimatedHours / available_days)),
        steps: scheduled
      };

      const hasBufferSteps = scheduled.some(s => s.scheduled_time && s.scheduled_time.includes("Buffer"));
      if (hasBufferSteps || totalEstimatedHours > targetCapacity) {
        result.risk.risk_level = "High";
        if (!result.risk.reasons.some((r: string) => r.includes("buffer"))) {
          result.risk.reasons.push("Workload is tight and requires scheduling subtasks into your 10-20% safety buffer before the deadline.");
        }
        result.analysis.risk_level = "High";
        result.analysis.warning = "High Risk: Required hours schedule into safety buffer days.";
      }
    }

    res.json(result);
  }
});

// 6. AI Advisor Chatbot
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, projectContext } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    let systemInstruction = "You are a professional project management advisor and technical developer named DeadlineAI. " +
      "Your goal is to help users solve project delays, optimize workload, improve code modularity, design schedules, analyze risks, " +
      "and suggest actionable productivity strategies. Be precise, encouraging, professional, and highly actionable.";

    if (projectContext) {
      systemInstruction += `\n\nHere is the active project details for context:\n` +
        `Name: ${projectContext.name}\n` +
        `Description: ${projectContext.description}\n` +
        `Deadline: ${projectContext.deadline}\n` +
        `Priority: ${projectContext.priority}\n` +
        `Progress: ${projectContext.progress}%\n` +
        `Risk Score: ${projectContext.risk?.risk_score || "N/A"}% (${projectContext.risk?.risk_level || "Unknown"} Risk)\n` +
        `AI Plan Steps: ${JSON.stringify(projectContext.plan?.steps || [])}\n` +
        `Completed Steps: ${JSON.stringify(projectContext.completedSteps || [])}\n` +
        `Daily Goals: ${JSON.stringify(projectContext.additionalAi?.daily_goals || [])}\n` +
        `Completed Goals: ${JSON.stringify(projectContext.completedGoals || [])}\n` +
        `Rescue Plan: ${JSON.stringify(projectContext.rescue?.rescue_plan || [])}\n`;
    }

    const contents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await callGemini({
      model: "gemini-3.5-flash",
      fallbackModel: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        systemInstruction
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Chat error in server, using programmatic fallback:", error);
    res.json({
      text: "I am currently receiving high-demand traffic across my AI cores, but I am still completely here to assist you! Based on your schedule, the best next steps are to keep ticking off those project subtask checkboxes, manage daily target work blocks, and maintain a consistent daily effort. Please let me know what specific task we should focus on next!",
      is_fallback: true
    });
  }
});

// Vite Middleware & Static Serving Setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
