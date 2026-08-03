Deployment environment variables

This project requires the following environment variables to be set in your hosting provider (e.g., Vercel, Railway, Lightning AI Cloudspaces).

- `COMFYUI_BASE_URL` — Base URL of your ComfyUI server (example: https://8188-01kywy5qx6mmcxb116e2smcpxp.cloudspaces.litng.ai). The app will proxy ComfyUI requests via `/api/comfy/*` to this URL.
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL (public).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public API key (safe for client usage).
- `SUPABASE_URL` — (Optional) Supabase URL for server-side code. If set, server-side code will prefer this.
- `SUPABASE_ANON_KEY` — (Optional) Supabase anon key for server-side code.
- `SUPABASE_SERVICE_ROLE_KEY` — (Optional) Supabase service role key (server-only). NEVER expose this in the browser.

How to set on Lightning AI Cloudspaces (example):
1. Open your Cloudspace dashboard.
2. Go to Environment / Secrets settings.
3. Add each variable name and its value.

Quick local testing:
```powershell
# Windows PowerShell - create local .env.local
Set-Content -Path .env.local -Value "COMFYUI_BASE_URL=https://your-cloud-url"
Add-Content -Path .env.local -Value "NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url"
Add-Content -Path .env.local -Value "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
```

After setting vars, restart Next.js:
```bash
npm run dev
```
