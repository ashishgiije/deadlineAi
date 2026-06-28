import { Project } from "../types";

export interface RescueStatusResult {
  isNeeded: boolean;
  reasons: string[];
  details: {
    remainingHoursExceeded: boolean;
    capacityOverlimit: boolean;
    riskCritical: boolean;
    consecutiveSkips: boolean;
    deadlineTodayUrgent: boolean;
    mathematicallyImpossible: boolean;
  };
  metrics: {
    remainingTaskHours: number;
    availableUserHours: number;
    capacityUsage: number;
    riskScore: number;
  };
}

export function checkRescueConditions(project: Project, profile: any): RescueStatusResult {
  // Condition 1: Remaining Task Hours > Available User Hours
  const totalHours = project.plan?.total_estimated_hours || project.analysis?.estimated_hours || 40;
  const completedSteps = project.completedSteps || [];
  let remainingTaskHours = 0;
  if (project.plan?.steps && project.plan.steps.length > 0) {
    remainingTaskHours = project.plan.steps
      .filter((s: any) => !completedSteps.includes(s.step))
      .reduce((sum: number, s: any) => sum + s.hours, 0);
  } else {
    remainingTaskHours = (1 - (project.progress / 100)) * totalHours;
  }

  // Available User Hours
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(project.deadline);
  deadline.setHours(23, 59, 59, 999);
  
  let availableUserHours = 0;
  if (deadline >= today) {
    const weekdayHours = profile?.weekday_hours !== undefined ? profile.weekday_hours : 4;
    const weekendHours = profile?.weekend_hours !== undefined ? profile.weekend_hours : 8;
    
    let current = new Date(today);
    while (current <= deadline) {
      const day = current.getDay();
      const isWeekend = (day === 0 || day === 6);
      availableUserHours += isWeekend ? weekendHours : weekdayHours;
      current.setDate(current.getDate() + 1);
    }
  }

  const cond1 = remainingTaskHours > availableUserHours;

  // Condition 2: Capacity Usage > 85%
  const capacityUsage = availableUserHours > 0 ? (remainingTaskHours / availableUserHours) * 100 : (remainingTaskHours > 0 ? 100 : 0);
  const cond2 = capacityUsage > 85;

  // Condition 3: Risk Score > 75%
  const riskScore = project.risk?.risk_score || 0;
  const cond3 = riskScore > 75;

  // Condition 4: User skipped scheduled tasks for 2 or more consecutive days
  let cond4 = false;
  if ((project as any).skippedDays >= 2 || (project as any).consecutiveSkips >= 2) {
    cond4 = true;
  } else if (project.createdAt && project.progress === 0) {
    const createdDate = new Date(project.createdAt);
    createdDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 2) {
      cond4 = true;
    }
  }

  // Condition 5: Deadline is today and progress < 100%
  const deadlineDate = new Date(project.deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const isToday = today.getTime() === deadlineDate.getTime();
  const cond5 = isToday && project.progress < 100;

  // Condition 6: Task is mathematically impossible to complete
  const cond6 = project.possible === false;

  const isNeeded = cond1 || cond2 || cond3 || cond4 || cond5 || cond6;

  const reasons: string[] = [];
  if (cond1) reasons.push(`Remaining Task Hours (${Math.round(remainingTaskHours)}h) exceed Available User Hours (${Math.round(availableUserHours)}h)`);
  if (cond2) reasons.push(`Capacity usage is critical (${Math.round(capacityUsage)}% > 85%)`);
  if (cond3) reasons.push(`Risk score is critical (${riskScore}% > 75%)`);
  if (cond4) reasons.push(`Scheduled tasks have been skipped for 2+ consecutive days`);
  if (cond5) reasons.push(`Deadline is today and project progress is incomplete (${project.progress}%)`);
  if (cond6) reasons.push(`Project checklist is mathematically impossible to complete: ${project.impossibleMessage || 'deadline constraints are too tight'}`);

  return {
    isNeeded,
    reasons,
    details: {
      remainingHoursExceeded: cond1,
      capacityOverlimit: cond2,
      riskCritical: cond3,
      consecutiveSkips: cond4,
      deadlineTodayUrgent: cond5,
      mathematicallyImpossible: cond6,
    },
    metrics: {
      remainingTaskHours,
      availableUserHours,
      capacityUsage,
      riskScore,
    }
  };
}
