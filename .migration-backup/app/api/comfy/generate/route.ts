import { NextResponse } from 'next/server';

const getBase = () => (process.env.COMFYUI_BASE_URL || '').replace(/\/$/, '');

const parseJson = (value: unknown) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

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
    const promptBody = parseJson(body);
    const rawPrompt = promptBody && typeof promptBody === 'object' && 'prompt' in promptBody ? (promptBody as any).prompt : promptBody;
    const parsedPrompt = parseJson(rawPrompt);
    const payload = { prompt: parsedPrompt };

    console.log('[api/comfy/generate] sending payload to /prompt', payload);

    const res = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
