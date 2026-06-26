import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getDemoMilestonesPayload, isDemoMode } from '@/lib/demo-data';

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
      return NextResponse.json(getDemoMilestonesPayload());
    }

    const supabase = await getSupabase();
    
    // Get committee_id from query params if filtering
    const url = new URL(req.url);
    const committeeId = url.searchParams.get('committee_id');

    let query = supabase
      .from('milestones')
      .select(`
        *,
        committee:committees (
          id,
          name
        )
      `)
      .order('deadline', { ascending: true });

    if (committeeId) {
      query = query.eq('committee_id', committeeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('GET /api/milestones error:', err);
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ message: 'Demo mode enabled' }, { status: 201 });
    }

    const supabase = await getSupabase();
    const body = await req.json();

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('milestones')
      .insert({
        title: body.title,
        description: body.description,
        deadline: body.deadline,
        committee_id: body.committee_id,
        weight: body.weight ?? 10,
        status: 'upcoming',
        progress_pct: 0,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/milestones error:', err);
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
}
