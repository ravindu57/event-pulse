'use client';

import { useState, useEffect } from 'react';
import { Committee, DailySubmission } from '@/types';
import { cn, formatRelative, formatDate } from '@/lib/utils';
import { mockSparklineData } from '@/lib/mock-data'; // keep for UI flair

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100, h = 30;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M${pts.join(' L')}`;
  const fillD = `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
  const colorMap: Record<string, string> = { tertiary: '#005338', error: '#ba1a1a', outline: '#777587', primary: '#3525cd' };
  const hex = colorMap[color] || '#3525cd';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <path d={fillD} fill={hex} opacity={0.1} />
      <path d={pathD} fill="none" stroke={hex} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CommitteeCard({ committee, onView }: { committee: Committee; onView: (c: Committee) => void }) {
  const statusMap: Record<string, { dot: string; label: string; border: string; bar: string; sparkColor: string }> = {
    on_track: { dot: 'bg-tertiary', label: 'text-tertiary', border: 'border-outline-variant', bar: 'bg-tertiary', sparkColor: 'tertiary' },
    at_risk: { dot: 'bg-error', label: 'text-error', border: 'border-error/30', bar: 'bg-error', sparkColor: 'error' },
    stalled: { dot: 'bg-outline', label: 'text-secondary', border: 'border-outline-variant', bar: 'bg-secondary', sparkColor: 'outline' },
    critical: { dot: 'bg-error', label: 'text-error', border: 'border-error/30', bar: 'bg-error', sparkColor: 'error' },
  };
  const s = statusMap[committee.status] || statusMap.stalled;
  const sparkData = mockSparklineData[committee.id] || [50, 60, 60, 70, 80, 80, 82]; // fallback flair
  const isAlert = committee.status === 'critical';

  return (
    <div className={cn(
      'bg-surface rounded-xl border flex flex-col hover:shadow-md transition-shadow duration-300 relative overflow-hidden group',
      s.border
    )}>
      {/* Top color strip */}
      <div className={cn('absolute top-0 left-0 w-full h-1', s.bar)}></div>
      {/* Alert pulse */}
      {isAlert && (
        <div className="absolute top-4 right-4 text-error bg-error-container w-8 h-8 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined fill-icon text-[16px] animate-pulse-slow">warning</span>
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col pt-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="pr-8">
            <h3 className="font-geist text-headline-sm text-on-surface font-semibold">{committee.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn('w-2 h-2 rounded-full', s.dot)}></span>
              <span className={cn('text-label-sm font-semibold', s.label)}>
                {committee.status === 'on_track' ? 'On Track' : committee.status === 'at_risk' ? 'At Risk' : committee.status === 'critical' ? 'Critical Delay' : 'Stalled'}
              </span>
            </div>
          </div>
          {!isAlert && (
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          )}
        </div>

        {/* Lead */}
        {committee.lead_name && (
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-on-surface font-geist text-[12px] font-semibold flex-shrink-0">
              {committee.lead_name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <p className="text-label-md font-medium text-on-surface leading-none mb-0.5">{committee.lead_name}</p>
              <p className="text-body-sm text-secondary text-[12px] leading-none">Committee Lead</p>
            </div>
          </div>
        )}

        {/* Streak */}
        {(committee.submission_streak ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 mb-4 text-tertiary-container bg-tertiary-container/10 px-2 py-1 rounded-lg w-fit">
            <span className="material-symbols-outlined fill-icon text-[14px]">local_fire_department</span>
            <span className="text-label-sm font-semibold">{committee.submission_streak} day streak</span>
          </div>
        )}

        {/* Progress Card */}
        <div className="mt-auto bg-surface-container-low rounded-lg p-3 border border-outline-variant/50">
          <div className="flex justify-between items-end mb-2">
            <span className="text-label-sm text-secondary">Completion Rate</span>
            <span className="font-geist text-headline-sm text-on-surface font-semibold leading-none">{committee.progress_pct}%</span>
          </div>
          <div className="h-8 w-full">
            <Sparkline data={sparkData} color={s.sparkColor} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={cn(
        'p-4 border-t flex items-center justify-between',
        isAlert ? 'border-error/20 bg-error-container/20' : 'border-outline-variant bg-surface-container-lowest'
      )}>
        <div className={cn('flex items-center gap-1.5', isAlert ? 'text-error' : 'text-secondary')}>
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          <span className="text-label-sm">{committee.last_submitted_at ? formatRelative(committee.last_submitted_at) : 'Never submitted'}</span>
        </div>
        <button
          onClick={() => onView(committee)}
          className={cn(
            'text-label-md flex items-center gap-1 group-hover:translate-x-0.5 transition-transform duration-200',
            isAlert ? 'text-error hover:text-on-error-container' : 'text-primary hover:text-primary-container'
          )}
        >
          {isAlert ? 'Review Blocker' : 'View Details'}
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

function DetailPanel({ committee, onClose }: { committee: Committee; onClose: () => void }) {
  const [submissions, setSubmissions] = useState<DailySubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const res = await fetch(`/api/submissions?committee_id=${committee.id}`);
        const data = await res.json();
        setSubmissions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, [committee.id]);

  return (
    <>
      <div
        className="fixed inset-0 bg-on-background/20 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      ></div>
      <aside className="fixed top-0 right-0 h-full w-full sm:w-[400px] lg:w-[480px] bg-surface shadow-2xl border-l border-outline-variant z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface-container-lowest">
          <div>
            <h2 className="font-geist text-headline-sm text-on-surface font-semibold">{committee.name}</h2>
            <p className="text-body-sm text-secondary mt-0.5">Submission History & Details</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-surface p-3 rounded-xl border border-outline-variant text-center">
              <p className="text-label-sm text-secondary mb-1">Progress</p>
              <p className="font-geist text-headline-sm text-on-surface font-semibold">{committee.progress_pct}%</p>
            </div>
            <div className="bg-surface p-3 rounded-xl border border-outline-variant text-center">
              <p className="text-label-sm text-secondary mb-1">Streak</p>
              <p className="font-geist text-headline-sm text-primary font-semibold">{committee.submission_streak ?? 0}d</p>
            </div>
            <div className="bg-surface p-3 rounded-xl border border-outline-variant text-center">
              <p className="text-label-sm text-secondary mb-1">Members</p>
              <p className="font-geist text-headline-sm text-on-surface font-semibold">{committee.member_count ?? 0}</p>
            </div>
          </div>

          {committee.description && (
            <div className="mb-6 p-4 bg-surface rounded-xl border border-outline-variant">
              <p className="text-label-sm text-secondary mb-1">About this committee</p>
              <p className="text-body-sm text-on-surface">{committee.description}</p>
            </div>
          )}

          <h3 className="text-label-md font-semibold text-on-surface mb-4">Recent Submissions</h3>

          {loading ? (
             <div className="flex justify-center p-4">
               <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
             </div>
          ) : submissions.length > 0 ? (
            <div className="relative border-l-2 border-surface-container-highest ml-4 space-y-5 pb-4">
              {submissions.map((sub) => (
                <div key={sub.id} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-tertiary border-4 border-background"></div>
                  <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-label-md font-medium text-on-surface">Daily Progress Report</h4>
                      <span className="text-label-sm text-secondary">{formatDate(sub.submission_date)}</span>
                    </div>
                    <p className="text-body-sm text-secondary mb-3 line-clamp-2">{sub.summary}</p>
                    {sub.llm_analysis && (
                      <div className="flex items-center gap-3">
                        <span className="text-label-sm text-tertiary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">trending_up</span>
                          {sub.llm_analysis.progress_pct}%
                        </span>
                        <span className={cn(
                          'text-label-sm capitalize',
                          sub.llm_analysis.sentiment === 'positive' ? 'text-tertiary' : 'text-secondary'
                        )}>
                          {sub.llm_analysis.sentiment}
                        </span>
                      </div>
                    )}
                    {sub.files && sub.files.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {sub.files.map((f: any) => (
                          <span key={f.name} className="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant text-label-sm text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">attachment</span>
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-secondary">
              <span className="material-symbols-outlined text-[48px] mb-3 block opacity-40">inbox</span>
              <p className="text-body-md">No submissions yet</p>
              <p className="text-body-sm mt-1">This committee hasn&apos;t submitted any reports.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant bg-surface flex gap-3">
          <button className="flex-1 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-label-md text-on-surface hover:bg-surface-container-high transition-colors">
            Contact Lead
          </button>
          <button className="flex-1 py-2.5 bg-primary text-on-primary rounded-xl text-label-md hover:bg-surface-tint transition-colors shadow-sm btn-tactile">
            Request Update
          </button>
        </div>
      </aside>
    </>
  );
}

export default function CommitteesPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Committee | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);

  // New Committee form state
  const [newComm, setNewComm] = useState({ name: '', description: '', lead_name: '', lead_email: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchCommittees() {
      try {
        const res = await fetch('/api/committees');
        const data = await res.json();
        setCommittees(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCommittees();
  }, []);

  const handleCreate = async () => {
    if (!newComm.name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/committees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComm)
      });
      if (res.ok) {
        const created = await res.json();
        setCommittees(prev => [...prev, created]);
        setShowNewModal(false);
        setNewComm({ name: '', description: '', lead_name: '', lead_email: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const filtered = committees.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  if (loading) {
    return <div className="p-8 flex items-center justify-center min-h-screen">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>;
  }

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">Committees</h2>
          <p className="text-body-lg text-secondary">Manage and track progress across all event operational groups.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md hover:bg-surface-tint transition-colors shadow-sm btn-tactile"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Committee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            placeholder="Search committees..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'on_track', 'at_risk', 'stalled', 'critical'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-full text-label-sm font-semibold transition-all',
                filter === f ? 'bg-primary text-on-primary' : 'bg-surface border border-outline-variant text-secondary hover:bg-surface-container-low'
              )}
            >
              {f === 'all' ? 'All' : f === 'on_track' ? 'On Track' : f === 'at_risk' ? 'At Risk' : f === 'stalled' ? 'Stalled' : 'Critical'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: committees.length, icon: 'groups', color: 'text-primary' },
          { label: 'On Track', value: committees.filter(c => c.status === 'on_track').length, icon: 'check_circle', color: 'text-tertiary' },
          { label: 'At Risk', value: committees.filter(c => c.status === 'at_risk' || c.status === 'stalled').length, icon: 'warning', color: 'text-error' },
          { label: 'Avg Progress', value: `${committees.length > 0 ? Math.round(committees.reduce((a, c) => a + (c.progress_pct||0), 0) / committees.length) : 0}%`, icon: 'trending_up', color: 'text-primary' },
        ].map(item => (
          <div key={item.label} className="bg-surface border border-outline-variant rounded-xl p-4 flex items-center gap-3">
            <span className={cn('material-symbols-outlined fill-icon', item.color)}>{item.icon}</span>
            <div>
              <p className="text-label-sm text-secondary">{item.label}</p>
              <p className="font-geist text-headline-sm text-on-surface font-semibold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(c => (
          <CommitteeCard key={c.id} committee={c} onView={setSelected} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-secondary">
          <span className="material-symbols-outlined text-[64px] block mb-4 opacity-30">search_off</span>
          <p className="text-body-lg">No committees found</p>
        </div>
      )}

      {/* Detail Panel */}
      {selected && <DetailPanel committee={selected} onClose={() => setSelected(null)} />}

      {/* New Committee Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm" onClick={() => setShowNewModal(false)}></div>
          <div className="relative bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col mx-4">
            <div className="px-6 py-4 border-b border-outline-variant bg-surface flex justify-between items-center">
              <h2 className="font-geist text-headline-sm text-on-surface font-semibold">Create New Committee</h2>
              <button onClick={() => setShowNewModal(false)} className="text-secondary hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div>
                <label className="block text-label-md font-medium text-on-surface mb-2">Committee Name</label>
                <input value={newComm.name} onChange={e => setNewComm(p => ({...p, name: e.target.value}))} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. Logistics & Venue" />
              </div>
              <div>
                <label className="block text-label-md font-medium text-on-surface mb-2">Description</label>
                <textarea value={newComm.description} onChange={e => setNewComm(p => ({...p, description: e.target.value}))} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" rows={3} placeholder="What does this committee do?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-medium text-on-surface mb-2">Lead Name</label>
                  <input value={newComm.lead_name} onChange={e => setNewComm(p => ({...p, lead_name: e.target.value}))} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none" placeholder="Sarah Jenkins" />
                </div>
                <div>
                  <label className="block text-label-md font-medium text-on-surface mb-2">Lead Email</label>
                  <input value={newComm.lead_email} onChange={e => setNewComm(p => ({...p, lead_email: e.target.value}))} type="email" className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none" placeholder="lead@event.com" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant bg-surface flex justify-end gap-3">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 bg-surface text-secondary border border-outline rounded-xl text-label-md hover:bg-surface-container-low">Cancel</button>
              <button disabled={creating} onClick={handleCreate} className="px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md btn-tactile hover:bg-surface-tint disabled:opacity-50">
                {creating ? 'Creating...' : 'Create Committee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
