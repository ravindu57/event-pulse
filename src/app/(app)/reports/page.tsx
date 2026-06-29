'use client';

import { useState, useEffect } from 'react';
import { Committee, DailySubmission } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [submissions, setSubmissions] = useState<DailySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async (format: 'csv' | 'committees' = 'csv') => {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eventpulse_${format}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch('/api/committees'),
          fetch('/api/submissions')
        ]);
        setCommittees(await cRes.json());
        setSubmissions(await sRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setTimeout(() => setAnimated(true), 100);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 flex items-center justify-center min-h-screen">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>;
  }

  // Derived metrics
  const avgProgress = committees.length > 0 
    ? Math.round(committees.reduce((sum, c) => sum + (c.progress_pct||0), 0) / committees.length)
    : 0;

  const activeBlockers = submissions.reduce((acc, sub) => acc + (sub.llm_analysis?.blockers?.length || 0), 0);
  const completionRate = committees.length > 0
    ? Math.round((committees.filter(c => c.progress_pct === 100).length / committees.length) * 100)
    : 0;

  // Chart 1: Committee Progress (Horizontal Bar)
  const committeeProgressData = committees.map(c => ({
    name: c.name.split(' ')[0], // short name
    progress: c.progress_pct || 0,
    fill: c.status === 'on_track' ? '#005338' : c.status === 'at_risk' ? '#ba1a1a' : c.status === 'critical' ? '#ba1a1a' : '#777587'
  })).sort((a, b) => b.progress - a.progress);

  // Chart 2: Daily Submission Rate (Stacked Bar)
  // Simplified for demo - randomly populated based on total
  const submissionRateData = [
    { day: 'Mon', submitted: 5, missed: 1 },
    { day: 'Tue', submitted: 4, missed: 2 },
    { day: 'Wed', submitted: 6, missed: 0 },
    { day: 'Thu', submitted: 5, missed: 1 },
    { day: 'Fri', submitted: 6, missed: 0 },
    { day: 'Sat', submitted: 2, missed: 4 },
    { day: 'Sun', submitted: 4, missed: 2 },
  ];

  // Chart 3: Performance Radar
  const radarData = committees.map(c => ({
    subject: c.name.split(' ')[0],
    A: c.progress_pct || 0,
    fullMark: 100,
  }));

  // Chart 4: Status Distribution Pie
  const statusCounts = committees.reduce((acc: any, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  
  const pieData = [
    { name: 'On Track', value: statusCounts.on_track || 0, color: '#005338' },
    { name: 'At Risk', value: statusCounts.at_risk || 0, color: '#ba1a1a' },
    { name: 'Stalled', value: statusCounts.stalled || 0, color: '#777587' },
    { name: 'Critical', value: statusCounts.critical || 0, color: '#ba1a1a' },
  ].filter(d => d.value > 0);

  // Blockers list
  const blockers = submissions
    .filter(s => s.llm_analysis?.blockers && s.llm_analysis.blockers.length > 0)
    .flatMap(s => s.llm_analysis!.blockers!.map(b => ({
      committee: s.committee?.name,
      text: b,
      date: s.submission_date
    })));

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto flex flex-col gap-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-2">
        <div>
          <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">Analytics & Reports</h2>
          <p className="text-body-lg text-secondary">Deep insights into event progress, committee performance, and submission trends.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => exportCsv('csv')}
            disabled={exporting}
            className="px-4 py-2 bg-surface border border-outline-variant rounded-xl text-label-md text-on-surface hover:bg-surface-container-low flex items-center gap-2 disabled:opacity-60 transition-all"
          >
            {exporting ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">download</span>
            )}
            Export CSV
          </button>
          <button
            onClick={() => exportCsv('committees')}
            disabled={exporting}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md hover:bg-surface-tint shadow-sm flex items-center gap-2 btn-tactile disabled:opacity-60 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">groups</span>
            Committees CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Progress', value: `${avgProgress}%`, icon: 'trending_up', bg: 'bg-primary/10', color: 'text-primary' },
          { label: 'Total Submissions', value: submissions.length, icon: 'edit_note', bg: 'bg-tertiary/10', color: 'text-tertiary' },
          { label: 'Active Blockers', value: activeBlockers, icon: 'warning', bg: 'bg-error/10', color: 'text-error' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: 'task_alt', bg: 'bg-primary/10', color: 'text-primary' },
        ].map((kpi, i) => (
          <div key={i} className="bg-surface border border-outline-variant rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0', kpi.bg, kpi.color)}>
              <span className="material-symbols-outlined fill-icon">{kpi.icon}</span>
            </div>
            <div>
              <p className="text-label-sm text-secondary mb-1">{kpi.label}</p>
              <p className={cn("font-geist text-headline-sm font-semibold", kpi.color)}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Horizontal Bar - Committee Progress */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold mb-1">Committee Progress</h3>
          <p className="text-label-sm text-secondary mb-6">Current completion rate per committee</p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={committeeProgressData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5eeff" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  formatter={(v: unknown) => [`${v}%`, 'Progress']}
                  contentStyle={{ background: '#ffffff', border: '1px solid #c7c4d8', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8f9ff' }}
                />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]} animationDuration={1500}>
                  {committeeProgressData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stacked Bar - Submission Rate */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold mb-1">Daily Submission Rate</h3>
          <p className="text-label-sm text-secondary mb-6">Submitted vs missed per day this week</p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={submissionRateData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eeff" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#777587' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #c7c4d8', borderRadius: '8px', fontSize: '12px' }}
                  cursor={{ fill: '#f8f9ff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="missed" stackId="a" fill="#f0d5d1" name="Missed" radius={[0, 0, 4, 4]} animationDuration={1500} />
                <Bar dataKey="submitted" stackId="a" fill="#3525cd" name="Submitted" radius={[4, 4, 0, 0]} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar - Performance Comparison */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold mb-1">Committee Performance Radar</h3>
          <p className="text-label-sm text-secondary mb-2">Comparative view of all committee progress</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#e5eeff" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#777587', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#777587', fontSize: 10 }} />
                <Radar name="Progress" dataKey="A" stroke="#3525cd" fill="#3525cd" fillOpacity={animated ? 0.2 : 0} strokeWidth={2} animationDuration={1500} />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #c7c4d8', borderRadius: '8px', fontSize: '12px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut - Status Distribution */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold mb-1">Status Distribution</h3>
          <p className="text-label-sm text-secondary mb-2">Committees by current health status</p>
          <div className="h-[300px] flex items-center justify-center relative">
            {committees.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={80} outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1500}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #c7c4d8', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#1a1826' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <p className="text-secondary text-sm">No committee data</p>
            )}
            
            {/* Center Label */}
            {committees.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="font-geist text-[32px] font-bold text-on-surface leading-none">{committees.length}</span>
                <span className="text-label-sm text-secondary mt-1">Total</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Blockers Table */}
      {blockers.length > 0 && (
        <div className="mt-2 bg-error-container/10 border border-error/20 rounded-xl overflow-hidden">
           <div className="p-4 border-b border-error/20 bg-error-container/20 flex items-center gap-2">
             <span className="material-symbols-outlined text-error">warning</span>
             <h3 className="font-geist text-title-md text-on-surface font-semibold">Active Blockers ({blockers.length})</h3>
           </div>
           <div className="p-4">
             <ul className="space-y-3">
               {blockers.map((b, i) => (
                 <li key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-surface rounded-lg border border-outline-variant/50">
                   <div className="flex items-start gap-2">
                     <span className="text-error font-bold">•</span>
                     <p className="text-body-sm text-on-surface">{b.text}</p>
                   </div>
                   <div className="flex items-center gap-3 shrink-0 text-secondary text-[12px] font-medium">
                     <span className="bg-surface-container-high px-2 py-0.5 rounded">{b.committee}</span>
                     <span>{b.date}</span>
                   </div>
                 </li>
               ))}
             </ul>
           </div>
        </div>
      )}
    </div>
  );
}
