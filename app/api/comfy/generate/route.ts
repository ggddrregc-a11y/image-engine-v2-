import { NextResponse } from 'next/server';

const getBase = () => (process.env.COMFYUI_BASE_URL || '').replace(/\/$/, '');

export async function POST(request: Request) {
  const base = getBase();
  if (!base) {
    return NextResponse.json({ error: 'COMFYUI_BASE_URL not configured' }, { status: 500 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      return NextResponse.json({ ok: res.ok, data: json }, { status: res.ok ? 200 : 502 });
    }
    const text = await res.text();
    return NextResponse.json({ ok: res.ok, data: text }, { status: res.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
