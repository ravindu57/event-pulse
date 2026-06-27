import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const url = new URL(req.url);
    const committeeId = url.searchParams.get('committee_id');

    let query = supabase
      .from('daily_submissions')
      .select(`
        id,
        submission_date,
        files,
        committee:committees (
          id,
          name
        )
      `)
      .order('submission_date', { ascending: false });

    if (committeeId) {
      query = query.eq('committee_id', committeeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Flatten files from all submissions
    const allFiles: object[] = [];
    for (const submission of (data || [])) {
      const files = (submission.files as { name: string; url: string; type: string; size: number }[]) || [];
      for (const file of files) {
        allFiles.push({
          ...file,
          submission_id: submission.id,
          submission_date: submission.submission_date,
          committee: submission.committee,
        });
      }
    }

    return NextResponse.json(allFiles);
  } catch (err: unknown) {
    console.error('GET /api/files error:', err);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}
