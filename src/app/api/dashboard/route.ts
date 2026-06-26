import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getDemoDashboardPayload, isDemoMode } from '@/lib/demo-data';

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
      return NextResponse.json(getDemoDashboardPayload());
    }

    const supabase = await getSupabase();

    // Fetch committees
    const { data: committees } = await supabase.from('committees').select('*');
    const totalCommittees = committees?.length || 0;
    
    // Fetch submissions for today
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: todaysSubmissions } = await supabase
      .from('daily_submissions')
      .select('*, committee:committees(name, status, progress_pct)')
      .eq('submission_date', todayStr);

    const committeesSubmittedToday = todaysSubmissions?.length || 0;

    // Fetch all submissions for blockers
    const { data: allSubmissions } = await supabase
      .from('daily_submissions')
      .select('llm_analysis')
      .not('llm_analysis', 'is', null);

    const activeBlockers = (allSubmissions || []).reduce((acc, sub) => {
      const blockers = sub.llm_analysis?.blockers || [];
      return acc + blockers.length;
    }, 0);

    // Calculate overall progress based on committees average
    const overallProgress = totalCommittees > 0 
      ? Math.round((committees || []).reduce((sum, c) => sum + (c.progress_pct || 0), 0) / totalCommittees)
      : 0;

    // We can fetch a recent progress snapshot for ai_brief or just generate one here dynamically.
    const { data: latestSnapshot } = await supabase
      .from('progress_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    const aiBrief = latestSnapshot?.ai_brief || `Event progress is tracking at ${overallProgress}%. ${committeesSubmittedToday}/${totalCommittees} committees have submitted updates today. There are currently ${activeBlockers} active blockers requiring attention.`;

    const dashboardSummary = {
      overall_progress: overallProgress,
      total_committees: totalCommittees,
      committees_submitted_today: committeesSubmittedToday,
      active_blockers: activeBlockers,
      ai_brief: aiBrief,
    };

    return NextResponse.json({
      summary: dashboardSummary,
      committees: committees || [],
      todays_submissions: todaysSubmissions || []
    });
  } catch (err: unknown) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
