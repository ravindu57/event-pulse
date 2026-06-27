import { NextRequest, NextResponse } from 'next/server';
import { getDemoCommitteesPayload, isDemoMode } from '@/lib/demo-data';
import { getAdminSupabase } from '@/lib/supabase/admin';

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json(getDemoCommitteesPayload());
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('committees')
      .select('*')
      .order('name');

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('GET /api/committees error:', err);
    return NextResponse.json({ error: 'Failed to fetch committees' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ message: 'Demo mode enabled' }, { status: 201 });
    }

    const supabase = getAdminSupabase();
    const body = await req.json();

    const { data, error } = await supabase
      .from('committees')
      .insert({
        name: body.name,
        description: body.description,
        lead_name: body.lead_name,
        lead_email: body.lead_email,
        status: 'on_track',
        progress_pct: 0,
        member_count: body.member_count ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/committees error:', err);
    return NextResponse.json({ error: 'Failed to create committee' }, { status: 500 });
  }
}
