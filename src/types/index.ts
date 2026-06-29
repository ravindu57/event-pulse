export type UserRole = 'admin' | 'committee_lead' | 'member';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  committee_id?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Committee {
  id: string;
  name: string;
  description?: string;
  lead_name?: string;
  lead_email?: string;
  status: 'on_track' | 'at_risk' | 'stalled' | 'critical';
  progress_pct: number;
  member_count?: number;
  submission_streak?: number;
  last_submitted_at?: string;
  created_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  deadline: string;
  committee_id: string;
  committee?: Committee;
  weight: number;
  status: 'upcoming' | 'in_progress' | 'at_risk' | 'completed';
  progress_pct: number;
  created_at: string;
}

export interface SubmissionFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface LLMAnalysis {
  progress_pct: number;
  completed_tasks: string[];
  blockers: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  key_metrics: Record<string, unknown>;
  overall_assessment: string;
  confidence_score?: number;
  needs_attention?: boolean;
  attention_reason?: string;
  coordinator_override?: boolean;
  provider?: string;
  raw_response?: string;
  analyzed_at: string;
}

export interface DailySubmission {
  id: string;
  committee_id: string;
  committee?: Committee;
  submission_date: string;
  summary: string;
  files: SubmissionFile[];
  llm_analysis?: LLMAnalysis;
  analysis_status?: 'pending' | 'processing' | 'done' | 'failed' | 'pending_retry';
  submitted_by: string;
  submitter?: Profile;
  created_at: string;
  updated_at?: string;
}

export interface DashboardSummary {
  overall_progress: number;
  days_to_event: number;
  total_committees: number;
  active_committees: number;
  active_blockers: number;
  total_submissions_today: number;
  committees_submitted_today: number;
  overdue_milestones: number;
  ai_brief: string;
  committee_progress: Array<{
    id: string;
    name: string;
    progress_pct: number;
    status: string;
    last_submitted_at?: string;
  }>;
}

export type NotificationType =
  | 'analysis_complete'
  | 'needs_attention'
  | 'milestone_due'
  | 'daily_reminder'
  | 'streak_broken';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CommitteeStats {
  committee_id: string;
  current_streak: number;
  longest_streak: number;
  total_submissions: number;
  last_submission_date?: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  milestone_id?: string;
  milestone_title?: string;
  completed: boolean;
}
