'use client';

import { useState, useEffect, useMemo } from 'react';
import { Committee } from '@/types';
import { cn } from '@/lib/utils';

interface FileRecord {
  name: string;
  url: string;
  type: string;
  size: number;
  submission_id: string;
  submission_date: string;
  committee: { id: string; name: string } | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileIcon(type: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'picture_as_pdf';
  if (['doc', 'docx'].includes(ext)) return 'description';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
  if (['ppt', 'pptx'].includes(ext)) return 'present_to_all';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'videocam';
  if (['zip', 'rar', '7z', 'tar'].includes(ext)) return 'folder_zip';
  if (type?.startsWith('image/')) return 'image';
  if (type?.startsWith('video/')) return 'videocam';
  if (type?.includes('pdf')) return 'picture_as_pdf';
  return 'attach_file';
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'text-red-500 bg-red-50';
  if (['doc', 'docx'].includes(ext)) return 'text-blue-600 bg-blue-50';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'text-green-600 bg-green-50';
  if (['ppt', 'pptx'].includes(ext)) return 'text-orange-500 bg-orange-50';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'text-purple-500 bg-purple-50';
  if (['zip', 'rar', '7z'].includes(ext)) return 'text-yellow-600 bg-yellow-50';
  return 'text-on-surface-variant bg-surface-container-high';
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');

  useEffect(() => {
    async function fetchData() {
      try {
        const [fRes, cRes] = await Promise.all([
          fetch('/api/files'),
          fetch('/api/committees'),
        ]);
        const filesData = await fRes.json();
        setFiles(Array.isArray(filesData) ? filesData : []);
        setCommittees(await cRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const fileTypes = useMemo(() => {
    const exts = new Set(files.map(f => f.name.split('.').pop()?.toLowerCase() || 'other'));
    return Array.from(exts).sort();
  }, [files]);

  const filtered = useMemo(() => {
    let result = files;
    if (search) result = result.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    if (committeeFilter !== 'all') result = result.filter(f => f.committee?.id === committeeFilter);
    if (typeFilter !== 'all') result = result.filter(f => (f.name.split('.').pop()?.toLowerCase() || 'other') === typeFilter);
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
      return new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime();
    });
    return result;
  }, [files, search, committeeFilter, typeFilter, sortBy]);

  const stats = useMemo(() => ({
    total: files.length,
    totalSize: files.reduce((a, f) => a + (f.size || 0), 0),
    committees: new Set(files.map(f => f.committee?.id).filter(Boolean)).size,
    today: files.filter(f => f.submission_date === new Date().toISOString().split('T')[0]).length,
  }), [files]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[1440px] mx-auto flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">
            File Tracker
          </h2>
          <p className="text-body-lg text-secondary">All documents and attachments submitted by committees.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('w-9 h-9 flex items-center justify-center rounded-xl border transition-colors',
              viewMode === 'grid' ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-secondary hover:bg-surface-container-low')}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn('w-9 h-9 flex items-center justify-center rounded-xl border transition-colors',
              viewMode === 'table' ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-secondary hover:bg-surface-container-low')}
          >
            <span className="material-symbols-outlined text-[18px]">table_rows</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Files', value: stats.total, icon: 'folder_open', color: 'text-primary' },
          { label: 'Total Size', value: formatBytes(stats.totalSize), icon: 'storage', color: 'text-tertiary' },
          { label: 'Committees', value: stats.committees, icon: 'groups', color: 'text-secondary' },
          { label: 'Today', value: stats.today, icon: 'today', color: 'text-primary' },
        ].map(item => (
          <div key={item.label} className="bg-surface border border-outline-variant rounded-xl p-4 flex items-center gap-3">
            <span className={cn('material-symbols-outlined fill-icon text-[22px]', item.color)}>{item.icon}</span>
            <div>
              <p className="text-label-sm text-secondary">{item.label}</p>
              <p className="font-geist text-headline-sm text-on-surface font-semibold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            placeholder="Search files..."
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

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm outline-none cursor-pointer"
        >
          <option value="all">All Types</option>
          {fileTypes.map(t => <option key={t} value={t}>.{t}</option>)}
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'date' | 'name' | 'size')}
          className="px-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm outline-none cursor-pointer"
        >
          <option value="date">Newest First</option>
          <option value="name">Name A–Z</option>
          <option value="size">Largest First</option>
        </select>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-[64px] mb-4 opacity-30">folder_open</span>
          <p className="text-body-lg font-medium">No files found</p>
          <p className="text-body-sm mt-1">
            {files.length === 0
              ? 'Files will appear here once committees submit reports with attachments.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((file, idx) => {
            const colorClass = getFileColor(file.name);
            const icon = getFileIcon(file.type, file.name);
            return (
              <div
                key={`${file.submission_id}-${idx}`}
                className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-3 hover:shadow-md hover:border-primary/40 transition-all group cursor-pointer"
              >
                {/* File icon */}
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center self-start', colorClass)}>
                  <span className="material-symbols-outlined text-[24px]">{icon}</span>
                </div>

                {/* File name */}
                <div className="min-w-0">
                  <p className="text-label-md font-semibold text-on-surface truncate group-hover:text-primary transition-colors" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-label-sm text-secondary mt-0.5">{formatBytes(file.size)}</p>
                </div>

                {/* Meta */}
                <div className="mt-auto pt-2 border-t border-outline-variant">
                  <p className="text-[11px] text-secondary truncate">{file.committee?.name || 'Unknown'}</p>
                  <p className="text-[11px] text-secondary">{formatDate(file.submission_date)}</p>
                </div>

                {/* Download button */}
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 w-full py-1.5 rounded-lg bg-primary/10 text-primary text-label-sm font-medium hover:bg-primary hover:text-on-primary transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Download
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && filtered.length > 0 && (
        <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant" style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
                  <th className="text-left px-5 py-3 text-label-sm font-semibold text-secondary">File</th>
                  <th className="text-left px-5 py-3 text-label-sm font-semibold text-secondary">Committee</th>
                  <th className="text-left px-5 py-3 text-label-sm font-semibold text-secondary">Date</th>
                  <th className="text-left px-5 py-3 text-label-sm font-semibold text-secondary">Size</th>
                  <th className="text-left px-5 py-3 text-label-sm font-semibold text-secondary">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((file, idx) => {
                  const colorClass = getFileColor(file.name);
                  const icon = getFileIcon(file.type, file.name);
                  return (
                    <tr key={`${file.submission_id}-${idx}`} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
                            <span className="material-symbols-outlined text-[16px]">{icon}</span>
                          </div>
                          <span className="text-label-md text-on-surface font-medium truncate max-w-[200px]" title={file.name}>{file.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-label-md text-on-surface-variant">{file.committee?.name || '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-label-md text-on-surface-variant">{formatDate(file.submission_date)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-label-md text-on-surface-variant">{formatBytes(file.size)}</span>
                      </td>
                      <td className="px-5 py-3">
                        {file.url ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-label-sm font-medium hover:bg-primary hover:text-on-primary transition-colors w-fit"
                          >
                            <span className="material-symbols-outlined text-[14px]">download</span>
                            Download
                          </a>
                        ) : (
                          <span className="text-label-sm text-secondary italic">No link</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-outline-variant" style={{ backgroundColor: 'var(--color-surface-container-low, #f5f5f5)' }}>
            <p className="text-label-sm text-secondary">{filtered.length} file{filtered.length !== 1 ? 's' : ''} shown</p>
          </div>
        </div>
      )}
    </div>
  );
}
