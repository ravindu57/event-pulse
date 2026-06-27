'use client';

import { useState, useEffect } from 'react';
import { cn, formatRelative, daysUntil } from '@/lib/utils';
import { mockCommittees, mockDashboard, mockSubmissions, mockMilestones } from '@/lib/mock-data';
import { DashboardSummary, Committee, DailySubmission, Milestone } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';

function ProgressRing({ pct, size = 64, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#dce9ff" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#3525cd" strokeWidth={stroke}
        strokeDasharray={`${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
    </svg>
  );
}

function CommitteeRow({ committee }: { committee: Committee }) {
  const statusColors: Record<string, string> = {
    on_track: 'bg-tertiary',
    at_risk: 'bg-error',
    stalled: 'bg-outline',
    critical: 'bg-error',
  };
  const barColors: Record<string, string> = {
    on_track: 'bg-tertiary',
    at_risk: 'bg-error',
    stalled: 'bg-secondary',
    critical: 'bg-error',
  };
  return (
    <div className="flex items-center gap-4 py-3 border-b border-outline-variant last:border-0">
      <div className="w-36 flex-shrink-0">
        <p className="text-label-md font-medium text-on-surface truncate">{committee.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors[committee.status])}></span>
          <span className="text-label-sm text-secondary capitalize">{committee.status.replace('_', ' ')}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-label-sm text-secondary">{committee.progress_pct}%</span>
          {committee.last_submitted_at && (
            <span className="text-label-sm text-secondary">{formatRelative(committee.last_submitted_at)}</span>
          )}
        </div>
        <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
          <div
            className={cn('h-2 rounded-full transition-all duration-1000', barColors[committee.status])}
            style={{ width: `${committee.progress_pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const weeklyData = [
  { day: 'Mon', submissions: 5, progress: 64 },
  { day: 'Tue', submissions: 4, progress: 66 },
  { day: 'Wed', submissions: 6, progress: 68 },
  { day: 'Thu', submissions: 5, progress: 70 },
  { day: 'Fri', submissions: 4, progress: 71 },
  { day: 'Sat', submissions: 2, progress: 71 },
  { day: 'Sun', submissions: 4, progress: 72 },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [submissions, setSubmissions] = useState<DailySubmission[]>([]);
  const [upcomingMilestones, setUpcomingMilestones] = useState<Milestone[]>([]);
  const [animated, setAnimated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          throw new Error('Unable to load dashboard data');
        }

        const json = await res.json();
        setData(json.summary ?? mockDashboard);
        setCommittees(Array.isArray(json.committees) && json.committees.length > 0 ? json.committees : mockCommittees);
        setSubmissions(Array.isArray(json.todays_submissions) && json.todays_submissions.length > 0 ? json.todays_submissions : mockSubmissions);
        setUpcomingMilestones(Array.isArray(json.upcoming_milestones) ? json.upcoming_milestones : []);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Live dashboard data is unavailable. Showing demo data instead.');
        setData(mockDashboard);
        setCommittees(mockCommittees);
        setSubmissions(mockSubmissions);
        setUpcomingMilestones(mockMilestones.filter(m => ['upcoming', 'in_progress', 'at_risk'].includes(m.status)).slice(0, 5));
      } finally {
        setLoading(false);
        setTimeout(() => setAnimated(true), 100);
      }
    }
    fetchData();
  }, []);

  const EVENT_DATE = new Date('2026-09-15');
  const daysRemaining = Math.max(0, daysUntil(EVENT_DATE));

  if (loading || !data) {
    return <div className="p-8 flex items-center justify-center min-h-screen">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>;
  }

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto flex flex-col gap-6 animate-fade-in">
      {error && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">
            Dashboard Overview
          </h2>
          <p className="text-body-lg text-secondary">High-level progress and critical metrics for Event Lead.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-label-md text-on-surface bg-surface-container-highest px-3 py-1.5 rounded-full border border-outline-variant flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span> Live Sync Active
          </span>
          <button className="bg-surface border border-outline text-on-surface hover:bg-surface-container-low transition-colors rounded-xl px-4 py-2 text-label-md shadow-sm">
            Export Report
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">

        {/* AI Executive Brief */}
        <div className="col-span-1 md:col-span-8 bg-surface border border-outline-variant rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl pointer-events-none"></div>
          <div className="flex items-center gap-3 border-b border-surface-container-high pb-3">
            <span className="material-symbols-outlined fill-icon text-primary">auto_awesome</span>
            <h3 className="font-geist text-headline-sm text-on-surface font-semibold">AI Executive Brief</h3>
            <span className="ml-auto text-label-sm text-secondary bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant">Today</span>
          </div>
          <p className="text-body-lg text-on-surface-variant leading-relaxed">
            {data.ai_brief}
          </p>
        </div>

        {/* Days to Event */}
        <div className="col-span-1 md:col-span-4 bg-primary text-on-primary rounded-xl p-6 flex flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 100%, rgba(255,255,255,0.4) 0%, transparent 60%)' }}></div>
          <span className="font-geist text-[72px] font-bold leading-none mb-1 relative z-10">{daysRemaining}</span>
          <span className="text-label-md uppercase tracking-widest opacity-90 relative z-10">Days to Event</span>
          <span className="text-label-sm opacity-70 mt-2 relative z-10">September 15, 2026</span>
        </div>

        {/* Overall Progress */}
        <div className="col-span-1 md:col-span-4 bg-surface border border-outline-variant rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-body-sm text-secondary mb-1">Overall Progress</p>
            <p className="font-geist text-headline-md text-on-surface font-semibold">{data.overall_progress}%</p>
            <p className="text-label-sm text-tertiary mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> +3% this week
            </p>
          </div>
          <div className="relative">
            <ProgressRing pct={animated ? data.overall_progress : 0} size={72} stroke={5} />
            <span className="absolute inset-0 flex items-center justify-center font-geist text-[14px] font-bold text-primary">
              {data.overall_progress}%
            </span>
          </div>
        </div>

        {/* Committees */}
        <div className="col-span-1 md:col-span-4 bg-surface border border-outline-variant rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-surface-container-high rounded-full text-primary">
            <span className="material-symbols-outlined fill-icon">groups</span>
          </div>
          <div>
            <p className="text-body-sm text-secondary mb-1">Total Committees</p>
            <p className="font-geist text-headline-md text-on-surface font-semibold">{data.total_committees} Active</p>
            <p className="text-label-sm text-secondary mt-1">{data.committees_submitted_today}/{data.total_committees} submitted today</p>
          </div>
        </div>

        {/* Active Blockers */}
        <div className="col-span-1 md:col-span-4 bg-error-container border border-error/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-error text-on-error rounded-full">
            <span className="material-symbols-outlined fill-icon">warning</span>
          </div>
          <div>
            <p className="text-body-sm text-on-error-container/70 mb-1">Active Blockers</p>
            <p className="font-geist text-headline-md text-on-error-container font-semibold">{data.active_blockers} Urgent</p>
            <p className="text-label-sm text-on-error-container/60 mt-1">Require immediate action</p>
          </div>
        </div>

        {/* Committee Progress Bars */}
        <div className="col-span-1 md:col-span-8 bg-surface border border-outline-variant rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-geist text-headline-sm text-on-surface font-semibold">Committee Progress</h3>
            <span className="text-label-sm text-secondary">All committees</span>
          </div>
          <div>
            {committees.map(c => <CommitteeRow key={c.id} committee={c} />)}
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div className="col-span-1 md:col-span-4 bg-surface border border-outline-variant rounded-xl p-6">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold mb-1">Weekly Submissions</h3>
          <p className="text-label-sm text-secondary mb-4">Daily submission count this week</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #c7c4d8', borderRadius: '8px', fontSize: '12px' }}
                cursor={{ fill: '#e5eeff' }}
              />
              <Bar dataKey="submissions" radius={[4, 4, 0, 0]}>
                {weeklyData.map((_, i) => (
                  <Cell key={i} fill={i === weeklyData.length - 1 ? '#3525cd' : '#dce9ff'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Progress Trend Line Chart */}
        <div className="col-span-1 md:col-span-6 bg-surface border border-outline-variant rounded-xl p-6">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold mb-1">Progress Trend</h3>
          <p className="text-label-sm text-secondary mb-4">Overall event progress over the past 7 days</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weeklyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eeff" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} domain={[60, 80]} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #c7c4d8', borderRadius: '8px', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="progress" stroke="#3525cd" strokeWidth={2} dot={{ fill: '#3525cd', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Milestones */}
        <div className="col-span-1 md:col-span-6 bg-surface border border-outline-variant rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-geist text-headline-sm text-on-surface font-semibold">Upcoming Milestones</h3>
            <a href="/timeline" className="text-label-md text-primary hover:underline flex items-center gap-1">
              View timeline <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
          <div className="space-y-3">
            {upcomingMilestones.map(m => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', 
                  m.status === 'at_risk' ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-primary')}>
                  <span className="material-symbols-outlined fill-icon text-[16px]">flag</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-label-md font-medium text-on-surface truncate">{m.title}</p>
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                      m.status === 'at_risk' ? 'bg-error text-on-error' : 'bg-surface-container-highest text-secondary'
                    )}>
                      {new Date(m.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-body-sm text-secondary truncate mt-0.5">{m.committee?.name || 'Unassigned'}</p>
                  <div className="w-full bg-surface-container-high rounded-full h-1 mt-2 overflow-hidden">
                    <div className={cn('h-full rounded-full', m.status === 'at_risk' ? 'bg-error' : 'bg-primary')} style={{ width: `${m.progress_pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {upcomingMilestones.length === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant">
                <p className="text-label-md font-medium text-secondary">No upcoming milestones.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="col-span-1 md:col-span-6 bg-surface border border-outline-variant rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-geist text-headline-sm text-on-surface font-semibold">Today&apos;s Submissions</h3>
            <a href="/submissions" className="text-label-md text-primary hover:underline flex items-center gap-1">
              View all <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined fill-icon text-primary text-[16px]">edit_note</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-label-md font-medium text-on-surface">{s.committee?.name}</p>
                  <p className="text-body-sm text-secondary line-clamp-1 mt-0.5">{s.summary}</p>
                  {s.llm_analysis && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-label-sm text-tertiary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">trending_up</span>
                        {s.llm_analysis.progress_pct}% progress
                      </span>
                      <span className={cn(
                        'text-label-sm capitalize',
                        s.llm_analysis.sentiment === 'positive' ? 'text-tertiary' : s.llm_analysis.sentiment === 'negative' ? 'text-error' : 'text-secondary'
                      )}>
                        {s.llm_analysis.sentiment}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {submissions.length === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant">
                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-secondary text-[16px]">inbox</span>
                </div>
                <div>
                  <p className="text-label-md font-medium text-on-surface">No submissions yet today</p>
                  <p className="text-body-sm text-secondary mt-0.5">Committees haven&apos;t filed their daily reports.</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
