'use client';

import { useState, useEffect } from 'react';
import { DailySubmission, Committee } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import { getDemoSubmissionsPayload, isDemoMode } from '@/lib/demo-data';
import { mockCommittees } from '@/lib/mock-data'; // Only for filters if needed, better to fetch

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<DailySubmission[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('all');
  const [selected, setSelected] = useState<DailySubmission | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        if (isDemoMode()) {
          setSubmissions(getDemoSubmissionsPayload());
          setCommittees(mockCommittees);
          return;
        }

        const [sRes, cRes] = await Promise.all([
          fetch('/api/submissions'),
          fetch('/api/committees')
        ]);
        setSubmissions(await sRes.json());
        setCommittees(await cRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = submissions.filter(s => {
    const matchSearch = s.summary.toLowerCase().includes(search.toLowerCase()) || 
                        (s.committee?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchCommittee = committeeFilter === 'all' || s.committee_id === committeeFilter;
    return matchSearch && matchCommittee;
  });

  if (loading) {
    return <div className="p-8 flex items-center justify-center min-h-screen">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>;
  }

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-2">
        <div>
          <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">Daily Submissions</h2>
          <p className="text-body-lg text-secondary">Review progress reports and AI-generated analysis.</p>
        </div>
        <a href="/submissions/new" className="px-4 py-2 bg-primary text-on-primary rounded-xl text-label-md hover:bg-surface-tint shadow-sm flex items-center gap-2 btn-tactile w-fit">
          <span className="material-symbols-outlined text-[18px]">add</span> New Submission
        </a>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm focus:border-primary outline-none"
            placeholder="Search reports..."
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

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant text-label-sm text-secondary uppercase tracking-wider">
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold">Committee</th>
                <th className="p-4 font-semibold">Summary</th>
                <th className="p-4 font-semibold">AI Sentiment</th>
                <th className="p-4 font-semibold">Files</th>
                <th className="p-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => (
                <tr key={sub.id} className="border-b border-outline-variant/50 hover:bg-surface-container-lowest transition-colors group cursor-pointer" onClick={() => setSelected(sub)}>
                  <td className="p-4 text-body-sm text-on-surface whitespace-nowrap">{formatDate(sub.submission_date)}</td>
                  <td className="p-4 text-label-md text-on-surface font-medium whitespace-nowrap">{sub.committee?.name}</td>
                  <td className="p-4 text-body-sm text-secondary max-w-xs truncate">{sub.summary}</td>
                  <td className="p-4">
                    {sub.llm_analysis ? (
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 w-fit',
                        sub.llm_analysis.sentiment === 'positive' ? 'bg-tertiary-container text-tertiary' :
                        sub.llm_analysis.sentiment === 'negative' ? 'bg-error-container text-error' :
                        'bg-surface-container-high text-on-surface-variant'
                      )}>
                        {sub.llm_analysis.sentiment}
                      </span>
                    ) : (
                      <span className="text-body-sm text-secondary">N/A</span>
                    )}
                  </td>
                  <td className="p-4 text-secondary">
                    {sub.files && sub.files.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">attachment</span>
                        <span className="text-body-sm">{sub.files.length}</span>
                      </div>
                    ) : (
                      <span className="text-body-sm">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto">
                      View <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-secondary">
                    No submissions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Slide-over */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-on-background/20 backdrop-blur-sm z-50 transition-opacity" onClick={() => setSelected(null)}></div>
          <aside className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-surface shadow-2xl border-l border-outline-variant z-50 flex flex-col animate-slide-in">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface-container-lowest">
              <div>
                <h2 className="font-geist text-headline-sm text-on-surface font-semibold">Report Details</h2>
                <p className="text-body-sm text-secondary mt-0.5">{formatDate(selected.submission_date)} • {selected.committee?.name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-label-sm text-secondary uppercase tracking-wider mb-2">Team Summary</h3>
                <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl">
                  <p className="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">{selected.summary}</p>
                </div>
              </div>

              {selected.llm_analysis && (
                <div>
                  <h3 className="text-label-sm text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span> AI Analysis
                  </h3>
                  <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface border border-outline-variant/50 p-3 rounded-lg text-center">
                        <p className="text-label-sm text-secondary">Progress Impact</p>
                        <p className="font-geist text-title-lg text-primary font-bold mt-1">+{selected.llm_analysis.progress_pct}%</p>
                      </div>
                      <div className="bg-surface border border-outline-variant/50 p-3 rounded-lg text-center">
                        <p className="text-label-sm text-secondary">Sentiment</p>
                        <p className={cn('font-geist text-title-lg font-bold mt-1 capitalize', 
                          selected.llm_analysis.sentiment === 'positive' ? 'text-tertiary' :
                          selected.llm_analysis.sentiment === 'negative' ? 'text-error' : 'text-primary'
                        )}>
                          {selected.llm_analysis.sentiment}
                        </p>
                      </div>
                    </div>
                    
                    {selected.llm_analysis.blockers && selected.llm_analysis.blockers.length > 0 && (
                      <div className="bg-error-container/20 border border-error-container p-3 rounded-lg flex items-start gap-3">
                        <span className="material-symbols-outlined text-error fill-icon text-[20px] mt-0.5">warning</span>
                        <div>
                          <p className="text-label-md font-semibold text-on-surface">Blockers Detected</p>
                          <ul className="mt-1 space-y-1">
                            {selected.llm_analysis.blockers.map((b, i) => (
                              <li key={i} className="text-body-sm text-on-surface-variant">• {b}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selected.files && selected.files.length > 0 && (
                <div>
                  <h3 className="text-label-sm text-secondary uppercase tracking-wider mb-2">Attached Files</h3>
                  <div className="space-y-2">
                    {selected.files.map((f: any, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-surface border border-outline-variant rounded-xl">
                        <span className="material-symbols-outlined text-primary">attachment</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-label-md text-on-surface truncate">{f.name}</p>
                          <p className="text-[10px] text-secondary">{f.type || 'Unknown type'}</p>
                        </div>
                        <button className="text-primary text-label-sm hover:underline">Download</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
