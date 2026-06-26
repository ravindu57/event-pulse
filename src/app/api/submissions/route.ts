import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getDemoSubmissionsPayload, isDemoMode } from '@/lib/demo-data';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function GET(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(getDemoSubmissionsPayload());
    }

    const supabase = await getSupabase();
    
    // Get committee_id from query params if filtering
    const url = new URL(req.url);
    const committeeId = url.searchParams.get('committee_id');

    let query = supabase
      .from('daily_submissions')
      .select(`
        *,
        committee:committees (
          id,
          name,
          status,
          progress_pct
        )
      `)
      .order('submission_date', { ascending: false });

    if (committeeId) {
      query = query.eq('committee_id', committeeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('GET /api/submissions error:', err);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ message: 'Demo mode enabled' }, { status: 201 });
    }

    const supabase = await getSupabase();
    const body = await req.json();

    const {
      committee_id,
      summary,
      files = [],
      llm_analysis,
      tasks_completed = []
    } = body;

    const { data: { user } } = await supabase.auth.getUser();

    // 1. Insert the daily submission
    const { data: submission, error: subError } = await supabase
      .from('daily_submissions')
      .insert({
        committee_id,
        summary,
        files,
        llm_analysis,
        submitted_by: user?.id,
        submission_date: new Date().toISOString().split('T')[0] // Today's date
      })
      .select()
      .single();

    if (subError) {
      if (subError.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'A submission for this committee already exists today.' }, { status: 409 });
      }
      throw subError;
    }

    // 2. Mark tasks as completed
    if (tasks_completed && tasks_completed.length > 0) {
      await supabase
        .from('tasks')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .in('id', tasks_completed);
    }

    // 3. Update committee progress and streak
    if (llm_analysis && typeof llm_analysis.progress_pct === 'number') {
      // Get current committee
      const { data: committee } = await supabase
        .from('committees')
        .select('progress_pct, submission_streak')
        .eq('id', committee_id)
        .single();
        
      if (committee) {
        let newStatus = 'on_track';
        if (llm_analysis.sentiment === 'negative') newStatus = 'at_risk';
        
        await supabase
          .from('committees')
          .update({
            progress_pct: Math.min(100, committee.progress_pct + llm_analysis.progress_pct),
            submission_streak: (committee.submission_streak || 0) + 1,
            last_submitted_at: new Date().toISOString(),
            status: newStatus
          })
          .eq('id', committee_id);
      }
    }

    return NextResponse.json(submission, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/submissions error:', err);
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 });
  }
}
