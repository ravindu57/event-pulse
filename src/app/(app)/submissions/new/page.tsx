'use client';

import { useState, useEffect, useRef } from 'react';
import { Committee, Milestone, Task, SubmissionFile } from '@/types';
import { cn, formatBytes } from '@/lib/utils';
import { format } from 'date-fns';
import { addDemoSubmission, isDemoMode } from '@/lib/demo-data';

interface AIPreview {
  progress_pct: number;
  sentiment: string;
  blockers?: string[];
  tasks?: Array<{ title: string; completed: boolean }>;
  loading: boolean;
}

export default function NewSubmissionPage() {
  const [summary, setSummary] = useState('');
  
  // Data from Supabase
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [aiPreview, setAiPreview] = useState<AIPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState<string>('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const demoMode = isDemoMode();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cRes, mRes] = await Promise.all([
          fetch('/api/committees'),
          fetch('/api/milestones')
        ]);
        const cData = await cRes.json();
        const mData = await mRes.json();
        
        setCommittees(cData);
        setMilestones(mData);
        if (cData.length > 0) setSelectedCommittee(cData[0].id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const today = format(new Date(), 'MMMM d, yyyy');
  const committee = committees.find(c => c.id === selectedCommittee);
  const upcomingMilestones = milestones.filter(m => m.committee_id === selectedCommittee && m.status !== 'completed');

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const newFiles: SubmissionFile[] = droppedFiles.map(f => ({
      name: f.name, url: URL.createObjectURL(f), type: f.type, size: f.size
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const getFileIcon = (type: string, fileName: string = '') => {
    if (type.includes('pdf')) return 'picture_as_pdf';
    if (type.includes('image')) return 'image';
    if (type.includes('spreadsheet') || type.includes('excel') || fileName.endsWith('.xlsx')) return 'table_chart';
    return 'description';
  };

  const analyzeWithAI = async () => {
    if (!summary.trim()) return;
    setAiPreview({ progress_pct: 0, sentiment: '', loading: true });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, committee_id: selectedCommittee, files: files.map(f => f.name) }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiPreview({
          progress_pct: data.progress_pct || 0,
          sentiment: data.sentiment || 'neutral',
          blockers: data.blockers || [],
          tasks: data.extracted_tasks || [],
          loading: false,
        });
        
        // Dynamically add AI extracted tasks if none exist
        if (data.extracted_tasks && data.extracted_tasks.length > 0 && tasks.length === 0) {
          setTasks(data.extracted_tasks.map((t: any, i: number) => ({
            id: `ai-${i}`,
            title: t.title,
            completed: t.completed,
            committee_id: selectedCommittee,
          })));
        }
      } else {
        setAiPreview({ progress_pct: 12, sentiment: 'positive', blockers: [], loading: false });
      }
    } catch {
      setAiPreview({ progress_pct: 12, sentiment: 'positive', blockers: [], loading: false });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (demoMode) {
        const demoLLMAnalysis = aiPreview
          ? {
              progress_pct: aiPreview.progress_pct,
              completed_tasks: aiPreview.tasks?.map(task => task.title) || [],
              blockers: aiPreview.blockers || [],
              sentiment: aiPreview.sentiment as 'positive' | 'neutral' | 'negative',
              key_metrics: {},
              overall_assessment: `Auto-generated analysis: ${aiPreview.sentiment} sentiment with ${aiPreview.progress_pct}% progress estimation.`,
              analyzed_at: new Date().toISOString(),
              provider: 'fallback',
            }
          : undefined;

        addDemoSubmission({
          committee_id: selectedCommittee,
          committee: committee as Committee,
          summary,
          files,
          llm_analysis: demoLLMAnalysis,
          submitted_by: 'demo@event.com',
          submission_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        setSubmitted(true);
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committee_id: selectedCommittee,
          summary,
          files,
          llm_analysis: aiPreview,
          tasks_completed: tasks.filter(t => t.completed).map(t => t.id)
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to submit report');
        setSubmitting(false);
        return;
      }
      
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !committee) {
    return <div className="p-8 flex items-center justify-center min-h-screen">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>;
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-full p-8 animate-fade-in mt-20">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-tertiary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined fill-icon text-tertiary text-[40px]">check_circle</span>
          </div>
          <h2 className="font-geist text-headline-md text-on-surface font-semibold mb-3">Submission Received!</h2>
          <p className="text-body-lg text-secondary mb-8">
            Your daily progress report for <strong>{committee.name}</strong> has been submitted and analyzed by AI.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/submissions" className="px-4 py-2 bg-surface border border-outline-variant rounded-xl text-label-md text-on-surface hover:bg-surface-container-low">
              View History
            </a>
            <button onClick={() => {
              setSubmitted(false);
              setSummary('');
              setFiles([]);
              setTasks([]);
              setAiPreview(null);
            }} className="px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md hover:bg-surface-tint btn-tactile">
              New Submission
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto pb-16 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-label-sm text-primary mb-1 uppercase tracking-wider font-semibold">{committee.name}</p>
        <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface leading-tight">Daily Progress Submission</h2>
        <p className="text-body-lg text-on-surface-variant mt-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-secondary">event</span>
          {today}
        </p>
      </div>

      {/* Committee Selector */}
      <div className="mb-6 max-w-sm">
        <label className="block text-label-md font-medium text-on-surface mb-2">Submitting for</label>
        <div className="relative">
          <select
            value={selectedCommittee}
            onChange={e => setSelectedCommittee(e.target.value)}
            className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-md appearance-none focus:border-primary outline-none cursor-pointer text-on-surface"
          >
            {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[16px] pointer-events-none">arrow_drop_down</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">

          {/* Summary */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <div className="mb-4 border-b border-outline-variant pb-4">
              <h3 className="font-geist text-headline-sm text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary fill-icon">edit_document</span>
                What did the team accomplish today?
              </h3>
            </div>
            <textarea
              value={summary}
              onChange={e => { setSummary(e.target.value); setAiPreview(null); }}
              className="w-full bg-surface text-on-surface border border-outline-variant rounded-xl p-4 text-body-md min-h-[160px] focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none resize-y"
              placeholder="Summarize key activities, metrics, and achievements. Be specific — the AI analyzes this to quantify progress..."
            />
            {summary.length > 20 && !aiPreview && (
              <button onClick={analyzeWithAI} className="mt-4 text-label-md text-primary flex items-center gap-1.5 hover:underline bg-primary/10 px-3 py-1.5 rounded-lg w-fit">
                <span className="material-symbols-outlined fill-icon text-[18px]">auto_awesome</span>
                Run AI Pre-Analysis
              </button>
            )}
          </div>

          {/* Task Checklist */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <div className="mb-4 border-b border-outline-variant pb-4 flex justify-between items-center">
              <h3 className="font-geist text-headline-sm text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary fill-icon">checklist</span>
                Task Progress
              </h3>
              <span className="bg-surface-container-high text-on-surface-variant text-label-sm px-3 py-1 rounded-full border border-outline-variant">
                {tasks.filter(t => t.completed).length}/{tasks.length} done
              </span>
            </div>
            
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map(task => (
                  <label key={task.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer group border border-transparent hover:border-outline-variant">
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.id)}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary bg-surface transition-all cursor-pointer"
                      />
                    </div>
                    <div className="flex-1">
                      <p className={cn('text-label-md font-medium transition-colors', task.completed ? 'text-on-surface-variant line-through' : 'text-on-surface group-hover:text-primary')}>
                        {task.title}
                      </p>
                      {task.milestone_title && (
                        <p className="text-body-sm text-on-surface-variant mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">flag</span>
                          {task.milestone_title}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-body-sm text-secondary">No specific tasks defined. Write a summary and let AI extract tasks for you!</p>
            )}
            
            <button className="mt-4 text-label-md text-primary flex items-center gap-1 hover:underline">
              <span className="material-symbols-outlined text-[16px]">add</span> Add Manual Task
            </button>
          </div>

          {/* File Upload */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <div className="mb-4 border-b border-outline-variant pb-4">
              <h3 className="font-geist text-headline-sm text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary fill-icon">upload_file</span>
                Supporting Assets
              </h3>
            </div>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all',
                isDragging ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-low hover:bg-surface-container-high hover:border-primary'
              )}
            >
              <span className={cn('material-symbols-outlined text-[48px] mb-4 transition-colors', isDragging ? 'text-primary' : 'text-on-surface-variant')}>
                cloud_upload
              </span>
              <p className="text-label-md text-on-surface font-medium">Drag & drop files here</p>
              <p className="text-body-sm text-on-surface-variant mt-1">or click to browse PDFs, Images, Docs, Sheets (Max 50MB)</p>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => {
              const f = Array.from(e.target.files || []).map(f => ({ name: f.name, url: '#', type: f.type, size: f.size }));
              setFiles(prev => [...prev, ...f]);
            }} />

            {files.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {files.map(file => (
                  <div key={file.name} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-outline-variant">
                    <span className="material-symbols-outlined text-primary fill-icon">{getFileIcon(file.type, file.name)}</span>
                    <div>
                      <p className="text-label-sm text-on-surface font-medium">{file.name}</p>
                      <p className="text-[10px] text-secondary">{formatBytes(file.size)}</p>
                    </div>
                    <button onClick={() => removeFile(file.name)} className="ml-2 text-on-surface-variant hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Context & Actions */}
        <div className="space-y-6">
          {/* Streak */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-tertiary-container/30 flex items-center justify-center border-4 border-tertiary-fixed/50 flex-shrink-0">
                <span className="material-symbols-outlined fill-icon text-tertiary-container text-[32px]">local_fire_department</span>
              </div>
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">Submission Streak</p>
                <p className="font-geist text-[36px] font-bold text-on-surface flex items-baseline gap-1">
                  {committee.submission_streak ?? 0} <span className="font-geist text-headline-sm text-on-surface-variant">Days</span>
                </p>
              </div>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-4">Consistent updates improve AI prediction accuracy by 14%.</p>
          </div>

          {/* Upcoming Milestones */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <h3 className="font-geist text-headline-sm text-on-surface font-semibold mb-4">Upcoming Milestones</h3>
            <div className="space-y-4">
              {upcomingMilestones.length > 0 ? upcomingMilestones.slice(0, 3).map((m, i) => {
                const days = Math.max(0, Math.floor((new Date(m.deadline).getTime() - Date.now()) / 86400000));
                const dotColors = ['bg-error', 'bg-primary', 'bg-tertiary', 'bg-outline'];
                return (
                  <div key={m.id} className="flex items-start gap-3">
                    <div className={cn('w-2 h-2 rounded-full mt-2 flex-shrink-0', dotColors[i] || 'bg-outline')}></div>
                    <div>
                      <p className="text-label-md font-medium text-on-surface">{m.title}</p>
                      <p className="text-body-sm text-on-surface-variant">
                        {days === 0 ? 'Due today' : `Due in ${days} day${days !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-body-sm text-secondary">No upcoming milestones</p>
              )}
            </div>
          </div>

          {/* AI Analysis Panel */}
          <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-6 bg-gradient-to-br from-surface-container-lowest to-surface-container-low shadow-sm">
            <div className="mb-4">
              <h3 className="text-label-md text-primary flex items-center gap-2 uppercase tracking-wide font-semibold">
                <span className="material-symbols-outlined fill-icon text-[18px]">auto_awesome</span>
                AI Pre-Analysis
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-1">
                {!aiPreview ? 'Write your summary to unlock AI insights...' : 'Based on your current draft'}
              </p>
            </div>

            {aiPreview?.loading && (
              <div className="flex flex-col gap-3 mb-6">
                <div className="skeleton h-8 w-full rounded-lg"></div>
                <div className="skeleton h-8 w-full rounded-lg"></div>
                <div className="skeleton h-12 w-full rounded-lg"></div>
              </div>
            )}

            {aiPreview && !aiPreview.loading && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="bg-surface p-3 rounded-xl border border-outline-variant/50">
                    <p className="text-label-sm text-on-surface-variant">Est. Progress</p>
                    <p className="font-geist text-headline-sm text-tertiary-container mt-1">+{aiPreview.progress_pct}%</p>
                  </div>
                  <div className="bg-surface p-3 rounded-xl border border-outline-variant/50">
                    <p className="text-label-sm text-on-surface-variant">Sentiment</p>
                    <p className={cn(
                      'font-geist text-headline-sm mt-1 flex items-center gap-1',
                      aiPreview.sentiment === 'positive' ? 'text-tertiary' : aiPreview.sentiment === 'negative' ? 'text-error' : 'text-primary'
                    )}>
                      {aiPreview.sentiment === 'positive' ? 'Positive' : aiPreview.sentiment === 'negative' ? 'Needs Work' : 'Neutral'}
                      <span className="material-symbols-outlined text-[14px]">{aiPreview.sentiment === 'positive' ? 'trending_up' : 'trending_flat'}</span>
                    </p>
                  </div>
                </div>

                {aiPreview.blockers && aiPreview.blockers.length > 0 && (
                  <div className="bg-error-container/20 p-3 rounded-xl border border-error-container mb-5 flex gap-3 items-start">
                    <span className="material-symbols-outlined fill-icon text-error text-[20px] mt-0.5 flex-shrink-0">warning</span>
                    <div>
                      <p className="text-label-sm text-on-surface font-semibold">Potential Blocker Detected</p>
                      <p className="text-body-sm text-on-surface-variant mt-0.5">{aiPreview.blockers[0]}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {!aiPreview && (
              <div className="h-24 flex items-center justify-center border-2 border-dashed border-outline-variant/50 rounded-xl mb-5">
                <p className="text-body-sm text-secondary text-center">AI insights appear<br />after you write your summary</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!summary.trim() || submitting}
              className={cn(
                'w-full py-3 px-4 rounded-xl text-label-md flex items-center justify-center gap-2 transition-all btn-tactile shadow-sm',
                summary.trim() && !submitting
                  ? 'bg-primary text-on-primary hover:bg-surface-tint'
                  : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
              )}
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Analyzing & Submitting...
                </>
              ) : (
                <>
                  Submit Daily Report
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
