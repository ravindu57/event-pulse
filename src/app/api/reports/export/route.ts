import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode, getDemoSubmissionsPayload, getDemoCommitteesPayload } from '@/lib/demo-data';

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCsvValue(row[h])).join(',')),
  ];
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'csv';
    const committeeId = url.searchParams.get('committee_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    let submissions: any[] = [];
    let committees: any[] = [];

    if (isDemoMode()) {
      submissions = getDemoSubmissionsPayload();
      committees = getDemoCommitteesPayload();
    } else {
      const supabase = getAdminSupabase();

      let query = supabase
        .from('daily_submissions')
        .select('*, committee:committees(name, status, progress_pct)')
        .order('submission_date', { ascending: false });

      if (committeeId) query = query.eq('committee_id', committeeId);
      if (from) query = query.gte('submission_date', from);
      if (to) query = query.lte('submission_date', to);

      const { data: subData } = await query;
      submissions = subData || [];

      const { data: comData } = await supabase.from('committees').select('*');
      committees = comData || [];
    }

    if (format === 'committees') {
      const rows = committees.map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        progress_pct: c.progress_pct,
        member_count: c.member_count ?? '',
        submission_streak: c.submission_streak ?? '',
        last_submitted_at: c.last_submitted_at ?? '',
        created_at: c.created_at,
      }));

      const csv = buildCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="committees_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default: submissions export
    const rows = submissions.map((s: any) => ({
      id: s.id,
      submission_date: s.submission_date,
      committee: s.committee?.name ?? s.committee_id,
      committee_status: s.committee?.status ?? '',
      summary: s.summary,
      analysis_status: s.analysis_status ?? '',
      ai_progress_pct: s.llm_analysis?.progress_pct ?? '',
      ai_sentiment: s.llm_analysis?.sentiment ?? '',
      ai_confidence: s.llm_analysis?.confidence_score ?? '',
      needs_attention: s.llm_analysis?.needs_attention ?? '',
      attention_reason: s.llm_analysis?.attention_reason ?? '',
      coordinator_override: s.llm_analysis?.coordinator_override ?? false,
      overall_assessment: s.llm_analysis?.overall_assessment ?? '',
      blockers: (s.llm_analysis?.blockers || []).join('; '),
      completed_tasks: (s.llm_analysis?.completed_tasks || []).join('; '),
      provider: s.llm_analysis?.provider ?? '',
      submitted_by: s.submitted_by ?? '',
      created_at: s.created_at,
    }));

    const csv = buildCsv(rows);
    const filename = `submissions_export_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('GET /api/reports/export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
