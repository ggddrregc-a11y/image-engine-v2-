import { NextResponse } from 'next/server';

const getBase = () => (process.env.COMFYUI_BASE_URL || '').replace(/\/$/, '');

export async function GET() {
  const base = getBase();
  if (!base) {
    return NextResponse.json({ error: 'COMFYUI_BASE_URL not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${base}/system_stats`, { method: 'GET' });
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
