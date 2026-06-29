import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/demo-data';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;

    if (isDemoMode()) {
      return NextResponse.json({ error: 'Not available in demo mode' }, { status: 403 });
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('daily_submissions')
      .select('id, llm_analysis, analysis_status, committee_id')
      .eq('id', submissionId)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/analysis/[submissionId] error:', err);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const body = await req.json();
    const { progress_pct, overall_assessment } = body;

    if (typeof progress_pct !== 'number' || progress_pct < 0 || progress_pct > 100) {
      return NextResponse.json(
        { error: 'progress_pct must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      return NextResponse.json({
        success: true,
        message: 'Override saved (demo mode — not persisted)',
        coordinator_override: true,
        progress_pct,
        overall_assessment,
      });
    }

    const supabase = getAdminSupabase();

    // Fetch current analysis
    const { data: submission, error: fetchErr } = await supabase
      .from('daily_submissions')
      .select('llm_analysis')
      .eq('id', submissionId)
      .single();

    if (fetchErr) throw fetchErr;

    const updatedAnalysis = {
      ...(submission?.llm_analysis || {}),
      progress_pct,
      overall_assessment,
      coordinator_override: true,
    };

    const { data, error } = await supabase
      .from('daily_submissions')
      .update({ llm_analysis: updatedAnalysis })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      submission: data,
    });
  } catch (err) {
    console.error('PUT /api/analysis/[submissionId] error:', err);
    return NextResponse.json({ error: 'Failed to save override' }, { status: 500 });
  }
}
