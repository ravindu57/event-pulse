import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getDemoCommitteesPayload, isDemoMode } from '@/lib/demo-data';

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

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json(getDemoCommitteesPayload());
    }

    const supabase = await getSupabase();
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

    const supabase = await getSupabase();
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
