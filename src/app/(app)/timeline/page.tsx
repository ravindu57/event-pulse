'use client';

import { useState, useEffect, useMemo } from 'react';
import { Milestone, Committee } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  upcoming:    { label: 'Upcoming',    color: 'bg-primary/10 text-primary',           bar: 'bg-primary',   dot: 'bg-primary' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',             bar: 'bg-blue-500',  dot: 'bg-blue-500' },
  at_risk:     { label: 'At Risk',     color: 'bg-error-container text-on-error-container', bar: 'bg-error', dot: 'bg-error' },
  completed:   { label: 'Completed',   color: 'bg-surface-container-high text-secondary', bar: 'bg-outline', dot: 'bg-outline' },
};

function daysFromNow(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShort(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Gantt helpers ── */
function GanttBar({ milestone, minDate, maxDate }: { milestone: Milestone; minDate: Date; maxDate: Date }) {
  const totalDays = (maxDate.getTime() - minDate.getTime()) / 86400000 || 1;
  const deadline = new Date(milestone.deadline);
  const start = Math.max(0, (deadline.getTime() - 7 * 86400000 - minDate.getTime()) / 86400000);
  const end = Math.min(totalDays, (deadline.getTime() - minDate.getTime()) / 86400000);
  const leftPct = (start / totalDays) * 100;
  const widthPct = Math.max(1, ((end - start) / totalDays) * 100);
  const cfg = STATUS_CONFIG[milestone.status] || STATUS_CONFIG.upcoming;
  const days = daysFromNow(milestone.deadline);

  return (
    <div className="relative h-8 flex items-center">
      <div
        className={cn('absolute h-6 rounded-full flex items-center px-2 text-[10px] font-bold text-white truncate cursor-pointer hover:brightness-110 transition-all', cfg.bar)}
        style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '40px' }}
        title={`${milestone.title} — ${formatDate(milestone.deadline)}`}
      >
        {milestone.title}
      </div>
      {/* Deadline pin */}
      <div
        className="absolute w-0.5 h-8 bg-on-surface/20"
        style={{ left: `${(end / totalDays) * 100}%` }}
      />
      <div
        className={cn('absolute -top-1 w-2 h-2 rounded-full border-2 border-surface', cfg.dot)}
        style={{ left: `calc(${(end / totalDays) * 100}% - 4px)` }}
      />
      {/* Days badge */}
      <span
        className={cn('absolute top-0 text-[9px] font-semibold px-1 rounded whitespace-nowrap',
          days < 0 ? 'text-error' : days <= 3 ? 'text-orange-600' : 'text-secondary'
        )}
        style={{ left: `calc(${(end / totalDays) * 100}% + 4px)` }}
      >
        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
      </span>
    </div>
  );
}

export default function TimelinePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'gantt' | 'list'>('gantt');
  const [filter, setFilter] = useState('all');
  const [committeeFilter, setCommitteeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', deadline: '', committee_id: '', priority: 'medium', weight: 10 });

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMilestones, setAiMilestones] = useState<any[]>([]);
  const [aiCommitteeId, setAiCommitteeId] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [mRes, cRes] = await Promise.all([fetch('/api/milestones'), fetch('/api/committees')]);
        setMilestones(await mRes.json());
        setCommittees(await cRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = useMemo(() => milestones.filter(m => {
    const matchStatus = filter === 'all' || m.status === filter;
    const matchComm = committeeFilter === 'all' || m.committee_id === committeeFilter;
    return matchStatus && matchComm;
  }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()), [milestones, filter, committeeFilter]);

  const { minDate, maxDate } = useMemo(() => {
    if (!filtered.length) return { minDate: new Date(), maxDate: new Date(Date.now() + 30 * 86400000) };
    const dates = filtered.map(m => new Date(m.deadline).getTime());
    const min = new Date(Math.min(...dates) - 14 * 86400000);
    const max = new Date(Math.max(...dates) + 7 * 86400000);
    return { minDate: min, maxDate: max };
  }, [filtered]);

  // Group by committee for Gantt
  const byCommittee = useMemo(() => {
    const map = new Map<string, { name: string; items: Milestone[] }>();
    for (const m of filtered) {
      const key = m.committee_id || 'unassigned';
      const name = m.committee?.name || 'Unassigned';
      if (!map.has(key)) map.set(key, { name, items: [] });
      map.get(key)!.items.push(m);
    }
    return Array.from(map.values());
  }, [filtered]);

  // Generate week labels for Gantt header
  const weekLabels = useMemo(() => {
    const labels: { label: string; pct: number }[] = [];
    const totalMs = maxDate.getTime() - minDate.getTime();
    const cur = new Date(minDate);
    while (cur <= maxDate) {
      const pct = ((cur.getTime() - minDate.getTime()) / totalMs) * 100;
      labels.push({ label: formatShort(cur.toISOString()), pct });
      cur.setDate(cur.getDate() + 7);
    }
    return labels;
  }, [minDate, maxDate]);

  // Today line position
  const todayPct = useMemo(() => {
    const totalMs = maxDate.getTime() - minDate.getTime();
    return Math.min(100, Math.max(0, ((Date.now() - minDate.getTime()) / totalMs) * 100));
  }, [minDate, maxDate]);

  const stats = useMemo(() => ({
    total: milestones.length,
    upcoming: milestones.filter(m => m.status === 'upcoming').length,
    atRisk: milestones.filter(m => m.status === 'at_risk').length,
    completed: milestones.filter(m => m.status === 'completed').length,
    overdue: milestones.filter(m => daysFromNow(m.deadline) < 0 && m.status !== 'completed').length,
  }), [milestones]);

  const handleCreate = async () => {
    if (!form.title || !form.deadline || !form.committee_id) return;
    setCreating(true);
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, weight: form.weight }),
      });
      if (res.ok) {
        const created = await res.json();
        const c = committees.find(c => c.id === created.committee_id);
        setMilestones(prev => [...prev, { ...created, committee: c }]);
        setShowModal(false);
        setForm({ title: '', description: '', deadline: '', committee_id: '', priority: 'medium', weight: 10 });
      }
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const handleAiProcess = async () => {
    if (!aiFile) return;
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', aiFile);
      const res = await fetch('/api/ai-schedule', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const extracted = await res.json();
        setAiMilestones(extracted);
      } else {
        alert('Failed to parse document with AI');
      }
    } catch (e) {
      console.error(e);
      alert('Error parsing document');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiMilestones = async () => {
    if (!aiCommitteeId || aiMilestones.length === 0) return;
    setAiLoading(true);
    try {
      const createdMilestones = [];
      for (const m of aiMilestones) {
        const res = await fetch('/api/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...m, committee_id: aiCommitteeId })
        });
        if (res.ok) {
          createdMilestones.push(await res.json());
        }
      }
      const c = committees.find(c => c.id === aiCommitteeId);
      setMilestones(prev => [...prev, ...createdMilestones.map(m => ({ ...m, committee: c }))]);
      
      setShowAiModal(false);
      setAiFile(null);
      setAiMilestones([]);
      setAiCommitteeId('');
    } catch (e) {
      console.error(e);
      alert('Failed to save milestones');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>
  );

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">Timeline Scheduler</h2>
          <p className="text-body-lg text-secondary">Committee deadlines, milestones, and event schedule at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-outline-variant rounded-xl overflow-hidden">
            {(['gantt', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-4 py-2 text-label-md font-medium transition-colors capitalize',
                  view === v ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container-low')}>
                <span className="material-symbols-outlined text-[16px] mr-1.5 align-[-3px]">{v === 'gantt' ? 'horizontal_split' : 'list'}</span>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface text-primary border border-outline-variant rounded-xl text-label-md hover:bg-surface-container-low transition-colors shadow-sm btn-tactile">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            AI Auto-Schedule
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md hover:opacity-90 transition-opacity shadow-sm btn-tactile">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Schedule Event
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: 'calendar_month', color: 'text-primary' },
          { label: 'Upcoming', value: stats.upcoming, icon: 'schedule', color: 'text-primary' },
          { label: 'At Risk', value: stats.atRisk, icon: 'warning', color: 'text-error' },
          { label: 'Completed', value: stats.completed, icon: 'check_circle', color: 'text-tertiary' },
          { label: 'Overdue', value: stats.overdue, icon: 'alarm', color: stats.overdue > 0 ? 'text-error' : 'text-secondary' },
        ].map(s => (
          <div key={s.label} className={cn('bg-surface border rounded-xl p-4 flex items-center gap-3', s.label === 'Overdue' && stats.overdue > 0 ? 'border-error/30 bg-error-container/10' : 'border-outline-variant')}>
            <span className={cn('material-symbols-outlined fill-icon text-[22px]', s.color)}>{s.icon}</span>
            <div>
              <p className="text-label-sm text-secondary">{s.label}</p>
              <p className="font-geist text-headline-sm text-on-surface font-semibold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'upcoming', 'in_progress', 'at_risk', 'completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-full text-label-sm font-semibold transition-all',
                filter === f ? 'bg-primary text-on-primary' : 'bg-surface border border-outline-variant text-secondary hover:bg-surface-container-low')}>
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f === 'at_risk' ? 'At Risk' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <select value={committeeFilter} onChange={e => setCommitteeFilter(e.target.value)}
            className="px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm outline-none cursor-pointer">
            <option value="all">All Committees</option>
            {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-[64px] mb-4 opacity-30">calendar_today</span>
          <p className="text-body-lg font-medium">No timeline events</p>
          <p className="text-body-sm mt-1">Click &ldquo;Schedule Event&rdquo; to add your first deadline.</p>
        </div>
      )}

      {/* ── GANTT VIEW ── */}
      {view === 'gantt' && filtered.length > 0 && (
        <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
          {/* Gantt header - week labels */}
          <div className="flex border-b border-outline-variant" style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
            <div className="w-52 flex-shrink-0 px-4 py-2 text-label-sm font-semibold text-secondary border-r border-outline-variant">Committee / Event</div>
            <div className="flex-1 relative h-8 overflow-hidden">
              {weekLabels.map((w, i) => (
                <span key={i} className="absolute text-[10px] text-secondary font-medium top-2 whitespace-nowrap"
                  style={{ left: `${w.pct}%`, transform: 'translateX(-50%)' }}>
                  {w.label}
                </span>
              ))}
            </div>
          </div>

          {/* Gantt rows */}
          {byCommittee.map(group => (
            <div key={group.name}>
              {/* Committee label row */}
              <div className="flex border-b border-outline-variant/50" style={{ backgroundColor: 'var(--color-surface-container-lowest, #fafafa)' }}>
                <div className="w-52 flex-shrink-0 px-4 py-2 flex items-center gap-2 border-r border-outline-variant">
                  <span className="material-symbols-outlined text-[14px] text-primary fill-icon">groups</span>
                  <span className="text-label-sm font-bold text-on-surface truncate">{group.name}</span>
                  <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">{group.items.length}</span>
                </div>
                <div className="flex-1 relative" />
              </div>
              {/* Milestone rows */}
              {group.items.map(m => (
                <div key={m.id} className="flex border-b border-outline-variant/30 hover:bg-surface-container-lowest/50 transition-colors">
                  <div className="w-52 flex-shrink-0 px-4 py-1 flex items-center gap-2 border-r border-outline-variant/30">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_CONFIG[m.status]?.dot || 'bg-secondary')} />
                    <span className="text-label-sm text-on-surface-variant truncate" title={m.title}>{m.title}</span>
                  </div>
                  <div className="flex-1 relative py-1 px-2">
                    {/* Today line */}
                    <div className="absolute inset-y-0 w-px bg-error/40 z-10" style={{ left: `${todayPct}%` }} />
                    <GanttBar milestone={m} minDate={minDate} maxDate={maxDate} />
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Today marker legend */}
          <div className="px-4 py-2 border-t border-outline-variant flex items-center gap-3" style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-px h-4 bg-error/50" />
              <span className="text-[10px] text-secondary">Today</span>
            </div>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn('w-3 h-3 rounded-sm', cfg.bar)} />
                <span className="text-[10px] text-secondary">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && filtered.length > 0 && (
        <div className="flex flex-col gap-4">
          {filtered.map(m => {
            const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.upcoming;
            const days = daysFromNow(m.deadline);
            const isOverdue = days < 0 && m.status !== 'completed';
            return (
              <div key={m.id} className={cn('bg-surface border rounded-2xl p-5 flex flex-col sm:flex-row gap-4 hover:shadow-md transition-shadow',
                isOverdue ? 'border-error/30 border-l-4 border-l-error' : m.status === 'at_risk' ? 'border-error/20' : 'border-outline-variant')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', cfg.color)}>{cfg.label}</span>
                    {isOverdue && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-error text-on-error">OVERDUE</span>}
                    <span className="text-label-sm text-secondary">{m.committee?.name || 'Unassigned'}</span>
                  </div>
                  <h3 className="text-label-lg font-semibold text-on-surface mb-1">{m.title}</h3>
                  {m.description && <p className="text-body-sm text-secondary line-clamp-2">{m.description}</p>}
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-secondary mb-1">
                      <span>Progress</span><span className="font-semibold">{m.progress_pct}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', cfg.bar)} style={{ width: `${m.progress_pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-secondary uppercase tracking-widest font-semibold">Deadline</p>
                    <p className={cn('text-label-md font-semibold', isOverdue ? 'text-error' : 'text-on-surface')}>
                      {formatDate(m.deadline)}
                    </p>
                    <p className={cn('text-[11px] mt-0.5', days < 0 ? 'text-error' : days <= 7 ? 'text-orange-500' : 'text-secondary')}>
                      {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days left`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-secondary uppercase tracking-widest font-semibold">Weight</p>
                    <p className="text-label-md font-semibold text-on-surface">{m.weight}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="relative w-full rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col"
            style={{ maxWidth: '560px', backgroundColor: 'var(--color-surface, #fff)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant"
              style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]">event</span>
                </div>
                <div>
                  <h2 className="font-geist text-title-md text-on-surface font-semibold leading-tight">Schedule New Event</h2>
                  <p className="text-label-sm text-secondary leading-tight mt-0.5">Add a deadline or milestone to the timeline</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Event / Milestone Title <span className="text-error">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant text-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  style={{ backgroundColor: 'var(--color-surface-container-lowest, #fff)' }}
                  placeholder="e.g. Venue booking confirmed" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant text-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                  style={{ backgroundColor: 'var(--color-surface-container-lowest, #fff)' }}
                  placeholder="Optional details about this deadline..." />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">Committee <span className="text-error">*</span></label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">groups</span>
                    <select value={form.committee_id} onChange={e => setForm(p => ({ ...p, committee_id: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant text-body-md outline-none focus:border-primary cursor-pointer appearance-none transition-all"
                      style={{ backgroundColor: 'var(--color-surface-container-lowest, #fff)' }}>
                      <option value="" disabled>Select committee…</option>
                      {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">Deadline <span className="text-error">*</span></label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">calendar_today</span>
                    <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant text-body-md outline-none focus:border-primary transition-all"
                      style={{ backgroundColor: 'var(--color-surface-container-lowest, #fff)' }} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Impact Weight: <span className="text-primary">{form.weight}%</span></label>
                <input type="range" min={1} max={100} value={form.weight} onChange={e => setForm(p => ({ ...p, weight: Number(e.target.value) }))}
                  className="w-full accent-primary cursor-pointer" />
                <p className="text-label-sm text-secondary">How much does this milestone contribute to overall progress?</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant"
              style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
              <button onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
              <button disabled={creating || !form.title.trim() || !form.deadline || !form.committee_id} onClick={handleCreate}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-medium btn-tactile hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity">
                {creating ? (
                  <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Saving…</>
                ) : (
                  <><span className="material-symbols-outlined text-[16px]">add</span>Add to Timeline</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── AI AUTO-SCHEDULE MODAL ── */}
      {showAiModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget && !aiLoading) { setShowAiModal(false); setAiFile(null); setAiMilestones([]); setAiCommitteeId(''); } }}>
          <div className="relative w-full rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col"
            style={{ maxWidth: '640px', backgroundColor: 'var(--color-surface, #fff)', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant"
              style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
                </div>
                <div>
                  <h2 className="font-geist text-title-md text-on-surface font-semibold leading-tight">AI Auto-Schedule</h2>
                  <p className="text-label-sm text-secondary leading-tight mt-0.5">Upload a plan or notes to auto-generate milestones</p>
                </div>
              </div>
              <button disabled={aiLoading} onClick={() => { setShowAiModal(false); setAiFile(null); setAiMilestones([]); setAiCommitteeId(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant disabled:opacity-50">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              {aiMilestones.length === 0 ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">Upload Document</label>
                    <div className="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-surface-container-lowest transition-colors relative cursor-pointer">
                      <input type="file" accept=".txt,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setAiFile(e.target.files?.[0] || null)} />
                      <span className="material-symbols-outlined text-[40px] text-primary mb-3">upload_file</span>
                      <p className="text-body-md text-on-surface font-medium">{aiFile ? aiFile.name : 'Click or drag a PDF/TXT file here'}</p>
                      <p className="text-body-sm text-secondary mt-1">AI will analyze it to extract deadlines and milestones.</p>
                    </div>
                  </div>
                  
                  {aiFile && (
                    <div className="flex justify-end">
                      <button disabled={aiLoading} onClick={handleAiProcess}
                        className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-medium btn-tactile hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                        {aiLoading ? (
                          <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Processing with AI...</>
                        ) : (
                          <><span className="material-symbols-outlined text-[16px]">psychology</span>Extract Milestones</>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">Assign to Committee <span className="text-error">*</span></label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">groups</span>
                      <select value={aiCommitteeId} onChange={e => setAiCommitteeId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant text-body-md outline-none focus:border-primary cursor-pointer appearance-none transition-all"
                        style={{ backgroundColor: 'var(--color-surface-container-lowest, #fff)' }}>
                        <option value="" disabled>Select committee...</option>
                        {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-label-md font-semibold text-on-surface mb-3 flex items-center justify-between">
                      Extracted Milestones
                      <span className="bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full">{aiMilestones.length} Found</span>
                    </h3>
                    <div className="flex flex-col gap-3">
                      {aiMilestones.map((m, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest flex flex-col gap-2 relative">
                          <button onClick={() => setAiMilestones(p => p.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-secondary hover:text-error transition-colors">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                          <div className="flex gap-2 items-start">
                            <div className="flex-1">
                              <input value={m.title} onChange={e => setAiMilestones(p => p.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} className="w-full font-semibold text-label-md text-on-surface outline-none bg-transparent" placeholder="Milestone Title" />
                              <input value={m.description} onChange={e => setAiMilestones(p => p.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} className="w-full text-body-sm text-secondary outline-none bg-transparent mt-1" placeholder="Description" />
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <input type="date" value={m.deadline} onChange={e => setAiMilestones(p => p.map((x, i) => i === idx ? { ...x, deadline: e.target.value } : x))} className="text-label-sm font-semibold text-on-surface outline-none bg-surface border border-outline-variant rounded px-2 py-1 mb-1" />
                              <div className="text-[10px] text-secondary">Weight: {m.weight}%</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-2">
                     <button disabled={aiLoading} onClick={() => { setAiMilestones([]); setAiFile(null); }}
                        className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50">
                        Discard All
                      </button>
                      <button disabled={aiLoading || !aiCommitteeId} onClick={handleSaveAiMilestones}
                        className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-medium btn-tactile hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                        {aiLoading ? (
                          <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Saving...</>
                        ) : (
                          <><span className="material-symbols-outlined text-[16px]">check</span>Save to Timeline</>
                        )}
                      </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
