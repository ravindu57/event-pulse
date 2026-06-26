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
  const [newM, setNewM] = useState({ title: '', description: '', deadline: '', committee_id: '', weight: 10 });
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
    todo: filtered.filter(m => m.status === 'at_risk'),
    in_progress: filtered.filter(m => m.status === 'upcoming' || m.status === 'in_progress'),
    completed: filtered.filter(m => m.status === 'completed'),
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Optimistic update
    const destStatusMap: Record<string, string> = {
      'col-todo': 'at_risk',
      'col-in_progress': 'on_track',
      'col-completed': 'completed'
    };
    
    const newStatus = destStatusMap[destination.droppableId];
    if (!newStatus) return;

    setMilestones(prev => prev.map(m => {
      if (m.id === draggableId) {
        return { ...m, status: newStatus as any, progress_pct: newStatus === 'completed' ? 100 : m.progress_pct };
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
          <div className="flex gap-6 min-w-[900px] h-full">
            
            {/* Column 1 */}
            <div className="flex flex-col w-1/3 min-w-[300px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-error"></span>
                <h3 className="font-geist text-title-md font-semibold text-on-surface">Critical / At Risk</h3>
                <span className="ml-auto bg-surface-container-high text-secondary text-label-sm px-2 py-0.5 rounded-full">{cols.todo.length}</span>
              </div>
              <Droppable droppableId="col-todo">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 bg-surface-container-lowest/50 rounded-2xl p-3 border border-dashed transition-colors', snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-outline-variant overflow-y-auto')}
                  >
                    <div className="space-y-4">
                      {cols.todo.map((m, i) => <MilestoneCard key={m.id} m={m} index={i} />)}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col w-1/3 min-w-[300px]">
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

            {/* Column 3 */}
            <div className="flex flex-col w-1/3 min-w-[300px]">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm" onClick={() => setShowNewModal(false)}></div>
          <div className="relative bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col mx-4 animate-fade-in">
            <div className="px-6 py-4 border-b border-outline-variant bg-surface flex justify-between items-center">
              <h2 className="font-geist text-headline-sm text-on-surface font-semibold">Create Milestone</h2>
              <button onClick={() => setShowNewModal(false)} className="text-secondary hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div>
                <label className="block text-label-md font-medium text-on-surface mb-2">Title</label>
                <input value={newM.title} onChange={e => setNewM(p => ({...p, title: e.target.value}))} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none" placeholder="e.g. Venue Booking Confirmation" />
              </div>
              <div>
                <label className="block text-label-md font-medium text-on-surface mb-2">Description</label>
                <textarea value={newM.description} onChange={e => setNewM(p => ({...p, description: e.target.value}))} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none resize-none" rows={2} placeholder="Optional details..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-medium text-on-surface mb-2">Deadline</label>
                  <input value={newM.deadline} onChange={e => setNewM(p => ({...p, deadline: e.target.value}))} type="date" className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-label-md font-medium text-on-surface mb-2">Committee</label>
                  <select value={newM.committee_id} onChange={e => setNewM(p => ({...p, committee_id: e.target.value}))} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md focus:border-primary outline-none cursor-pointer">
                    <option value="" disabled>Select...</option>
                    {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant bg-surface flex justify-end gap-3">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 bg-surface text-secondary border border-outline rounded-xl text-label-md hover:bg-surface-container-low">Cancel</button>
              <button disabled={creating || !newM.title || !newM.deadline || !newM.committee_id} onClick={handleCreate} className="px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md btn-tactile hover:bg-surface-tint disabled:opacity-50">
                {creating ? 'Saving...' : 'Create Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
