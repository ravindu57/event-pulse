'use client';

import { useState, useEffect, useMemo } from 'react';
import { Milestone, Committee } from '@/types';
import { cn, formatRelative, formatDate } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function MilestoneCard({ m, index }: { m: Milestone; index: number }) {
  const isCritical = m.status === 'at_risk';
  const isCompleted = m.status === 'completed';
  const days = Math.floor((new Date(m.deadline).getTime() - Date.now()) / 86400000);
  const isOverdue = days < 0 && !isCompleted;

  return (
    <Draggable draggableId={m.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            'bg-surface border rounded-xl p-4 transition-all',
            snapshot.isDragging ? 'shadow-xl rotate-2 z-50 scale-105' : 'shadow-sm',
            isCompleted ? 'border-outline-variant bg-surface-container-lowest opacity-80' : 
            isCritical ? 'border-error/40 border-l-4 border-l-error' : 'border-outline-variant border-l-4 border-l-primary'
          )}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1',
              isCompleted ? 'bg-surface-container-high text-secondary' :
              isCritical ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-primary'
            )}>
              {isCompleted ? <span className="material-symbols-outlined text-[12px]">done_all</span> : null}
              {isCritical ? <span className="material-symbols-outlined text-[12px]">warning</span> : null}
              {m.status.replace('_', ' ')}
            </span>
          </div>

          <h4 className={cn('text-label-md font-semibold mb-2', isCompleted ? 'text-secondary line-through' : 'text-on-surface')}>
            {m.title}
          </h4>

          {m.description && (
            <p className="text-body-sm text-on-surface-variant mb-4 line-clamp-2">{m.description}</p>
          )}

          <div className="flex justify-between items-end gap-2 mb-4">
            <div>
              <p className="text-[10px] text-secondary uppercase tracking-widest font-semibold mb-0.5">Deadline</p>
              <p className={cn('text-label-sm flex items-center gap-1', isOverdue ? 'text-error font-semibold' : 'text-on-surface-variant')}>
                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                {formatDate(m.deadline)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-secondary uppercase tracking-widest font-semibold mb-0.5">Committee</p>
              <p className="text-label-sm text-on-surface-variant truncate max-w-[100px]">{m.committee?.name || 'Unassigned'}</p>
            </div>
          </div>

          <div className="w-full bg-surface-container-high rounded-full h-1.5 mb-1 overflow-hidden">
            <div
              className={cn('h-1.5 rounded-full', isCompleted ? 'bg-outline' : isCritical ? 'bg-error' : 'bg-primary')}
              style={{ width: `${m.progress_pct}%` }}
            ></div>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-secondary">Progress (Weight: {m.weight}%)</span>
            <span className="text-[10px] text-secondary font-semibold">{m.progress_pct}%</span>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newM, setNewM] = useState({ title: '', description: '', deadline: '', committee_id: '', weight: 10, priority: 'medium' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [mRes, cRes] = await Promise.all([
          fetch('/api/milestones'),
          fetch('/api/committees')
        ]);
        setMilestones(await mRes.json());
        setCommittees(await cRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return milestones.filter(m => {
      const matchS = m.title.toLowerCase().includes(search.toLowerCase());
      const matchC = committeeFilter === 'all' || m.committee_id === committeeFilter;
      return matchS && matchC;
    });
  }, [milestones, search, committeeFilter]);

  const cols = {
    at_risk:     filtered.filter(m => m.status === 'at_risk'),
    upcoming:    filtered.filter(m => m.status === 'upcoming'),
    in_progress: filtered.filter(m => m.status === 'in_progress'),
    completed:   filtered.filter(m => m.status === 'completed'),
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Map droppable column IDs → valid Milestone status values
    const destStatusMap: Record<string, Milestone['status']> = {
      'col-at_risk':     'at_risk',
      'col-upcoming':    'upcoming',
      'col-in_progress': 'in_progress',
      'col-completed':   'completed',
    };

    const newStatus = destStatusMap[destination.droppableId];
    if (!newStatus) return;

    setMilestones(prev => prev.map(m => {
      if (m.id === draggableId) {
        return { ...m, status: newStatus, progress_pct: newStatus === 'completed' ? 100 : m.progress_pct };
      }
      return m;
    }));

    // In a real app we'd trigger a Supabase update here
  };

  const handleCreate = async () => {
    if (!newM.title || !newM.deadline || !newM.committee_id) return;
    setCreating(true);
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newM)
      });
      if (res.ok) {
        const created = await res.json();
        // re-fetch to get committee join or just manually push
        const c = committees.find(c => c.id === created.committee_id);
        setMilestones(prev => [...prev, { ...created, committee: c }]);
        setShowNewModal(false);
        setNewM({ title: '', description: '', deadline: '', committee_id: '', weight: 10, priority: 'medium' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center min-h-screen">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>;
  }

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto h-[calc(100vh-80px)] flex flex-col animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-6 flex-shrink-0">
        <div>
          <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">Milestone Management</h2>
          <p className="text-body-lg text-secondary">Track critical path progress across all event committees.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-surface border border-outline-variant rounded-xl text-label-md text-on-surface hover:bg-surface-container-low flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">download</span> Export
          </button>
          <button onClick={() => setShowNewModal(true)} className="px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md hover:bg-surface-tint shadow-sm flex items-center gap-2 btn-tactile">
            <span className="material-symbols-outlined text-[18px]">add</span> Create Milestone
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-shrink-0">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm focus:border-primary outline-none"
            placeholder="Search milestones..."
          />
        </div>
        <select
          value={committeeFilter}
          onChange={e => setCommitteeFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm outline-none cursor-pointer"
        >
          <option value="all">All Committees</option>
          {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex gap-4 min-w-[1200px] h-full">

            {/* Column 1 — At Risk */}
            <div className="flex flex-col w-1/4 min-w-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-error"></span>
                <h3 className="font-geist text-title-md font-semibold text-on-surface">Critical / At Risk</h3>
                <span className="ml-auto bg-surface-container-high text-secondary text-label-sm px-2 py-0.5 rounded-full">{cols.at_risk.length}</span>
              </div>
              <Droppable droppableId="col-at_risk">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 bg-surface-container-lowest/50 rounded-2xl p-3 border border-dashed transition-colors', snapshot.isDraggingOver ? 'border-error bg-error/5' : 'border-outline-variant overflow-y-auto')}
                  >
                    <div className="space-y-4">
                      {cols.at_risk.map((m, i) => <MilestoneCard key={m.id} m={m} index={i} />)}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Column 2 — Upcoming */}
            <div className="flex flex-col w-1/4 min-w-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                <h3 className="font-geist text-title-md font-semibold text-on-surface">Upcoming</h3>
                <span className="ml-auto bg-surface-container-high text-secondary text-label-sm px-2 py-0.5 rounded-full">{cols.upcoming.length}</span>
              </div>
              <Droppable droppableId="col-upcoming">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 bg-surface-container-lowest/50 rounded-2xl p-3 border border-dashed transition-colors', snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-outline-variant overflow-y-auto')}
                  >
                    <div className="space-y-4">
                      {cols.upcoming.map((m, i) => <MilestoneCard key={m.id} m={m} index={i} />)}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Column 3 — In Progress */}
            <div className="flex flex-col w-1/4 min-w-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <h3 className="font-geist text-title-md font-semibold text-on-surface">In Progress</h3>
                <span className="ml-auto bg-surface-container-high text-secondary text-label-sm px-2 py-0.5 rounded-full">{cols.in_progress.length}</span>
              </div>
              <Droppable droppableId="col-in_progress">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 bg-surface-container-lowest/50 rounded-2xl p-3 border border-dashed transition-colors', snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-outline-variant overflow-y-auto')}
                  >
                    <div className="space-y-4">
                      {cols.in_progress.map((m, i) => <MilestoneCard key={m.id} m={m} index={i} />)}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Column 4 — Completed */}
            <div className="flex flex-col w-1/4 min-w-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-outline"></span>
                <h3 className="font-geist text-title-md font-semibold text-on-surface">Completed</h3>
                <span className="ml-auto bg-surface-container-high text-secondary text-label-sm px-2 py-0.5 rounded-full">{cols.completed.length}</span>
              </div>
              <Droppable droppableId="col-completed">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 bg-surface-container-lowest/50 rounded-2xl p-3 border border-dashed transition-colors', snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-outline-variant overflow-y-auto')}
                  >
                    <div className="space-y-4">
                      {cols.completed.map((m, i) => <MilestoneCard key={m.id} m={m} index={i} />)}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

          </div>
        </div>
      </DragDropContext>

      {/* New Milestone Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowNewModal(false); setNewM({ title: '', description: '', deadline: '', committee_id: '', weight: 10, priority: 'medium' }); } }}>
          <div className="relative w-full rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col animate-fade-in"
            style={{ maxWidth: '560px', backgroundColor: 'var(--color-surface, #fff)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant"
              style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]">flag</span>
                </div>
                <div>
                  <h2 className="font-geist text-title-md text-on-surface font-semibold leading-tight">Create Milestone</h2>
                  <p className="text-label-sm text-secondary leading-tight mt-0.5">Add a tracked checkpoint to the event timeline</p>
                </div>
              </div>
              <button onClick={() => { setShowNewModal(false); setNewM({ title: '', description: '', deadline: '', committee_id: '', weight: 10, priority: 'medium' }); }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Title <span className="text-error">*</span></label>
                <input value={newM.title} onChange={e => setNewM(p => ({...p, title: e.target.value}))} autoFocus
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="e.g. Venue Booking Confirmation" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Description</label>
                <textarea value={newM.description} onChange={e => setNewM(p => ({...p, description: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all"
                  rows={2} placeholder="Optional details about this milestone..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">Committee <span className="text-error">*</span></label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">groups</span>
                    <select value={newM.committee_id} onChange={e => setNewM(p => ({...p, committee_id: e.target.value}))}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none cursor-pointer appearance-none transition-all">
                      <option value="" disabled>Select committee…</option>
                      {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">Deadline <span className="text-error">*</span></label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">calendar_today</span>
                    <input value={newM.deadline} onChange={e => setNewM(p => ({...p, deadline: e.target.value}))} type="date"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none transition-all" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">Impact Weight: <span className="text-primary">{newM.weight}%</span></label>
                <input type="range" min={1} max={100} value={newM.weight} onChange={e => setNewM(p => ({...p, weight: Number(e.target.value)}))}
                  className="w-full accent-primary cursor-pointer" />
                <p className="text-label-sm text-secondary">How much does this milestone contribute to overall progress?</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3" style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
              <button onClick={() => setShowNewModal(false)}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
              <button disabled={creating || !newM.title.trim() || !newM.deadline || !newM.committee_id} onClick={handleCreate}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-label-md font-medium btn-tactile hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity">
                {creating ? (
                  <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Saving…</>
                ) : (
                  <><span className="material-symbols-outlined text-[16px]">flag</span>Create Milestone</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
