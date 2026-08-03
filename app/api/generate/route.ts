import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ComfyUIWorkflow } from '@/lib/admin-types';

interface GenerateRequest {
  prompt: string;
  negativePrompt?: string;
  model: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  sampler: string;
  batchCount: number;
  quality: 'standard' | 'high';
  workflowId?: string;
}

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const findComfyUIWorkflow = async (workflowId?: string) => {
  if (workflowId) {
    const { data, error } = await supabase
      .from('comfyui_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (!error && data) return data as ComfyUIWorkflow;
  }

  const { data, error } = await supabase
    .from('comfyui_workflows')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) return data as ComfyUIWorkflow;
  return null;
};

const clampCfg = (value: number) => Math.min(1.5, Math.max(1.0, value));

const resolveQualitySteps = (quality: 'standard' | 'high') => (quality === 'high' ? 9 : 4);

const generateSeed = () => {
  const seed = Math.floor(Math.random() * 0x7fffffff);
  return seed;
};

const patchWorkflow = (
  workflowJson: Record<string, unknown>,
  width: number,
  height: number,
  quality: 'standard' | 'high',
) => {
  const updated = { ...workflowJson };
  const qualitySteps = resolveQualitySteps(quality);
  const seed = generateSeed();

  for (const [nodeId, nodeData] of Object.entries(updated)) {
    if (typeof nodeData !== 'object' || nodeData === null) continue;
    const node = nodeData as Record<string, unknown>;
    const classType = String(node.class_type ?? '');
    const inputs = node.inputs as Record<string, unknown> | undefined;
    if (!inputs) continue;

    const isLatentImage = classType.includes('EmptySD3LatentImage') || classType.includes('EmptyLatentImage');
    const isModelSampler = classType.includes('KSampler') || nodeId === 'KSamplerSelect';

    if (isLatentImage) {
      updated[nodeId] = {
        ...node,
        inputs: {
          ...inputs,
          width,
          height,
        },
      };
      continue;
    }

    if (isModelSampler) {
      updated[nodeId] = {
        ...node,
        inputs: {
          ...inputs,
          steps: qualitySteps,
          seed,
          cfg: clampCfg(1.25),
          width,
          height,
        },
      };
    }
  }
  return updated;
};

const postToComfyUI = async (serverUrl: string, workflowJson: Record<string, unknown>) => {
  const endpoint = normalizeUrl(serverUrl);
  const response = await fetch(`${endpoint}/api/workflows/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflow: workflowJson }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ComfyUI request failed: ${response.status} ${text}`);
  }

  return response.json();
};

export async function POST(request: Request) {
  const body = await request.json() as GenerateRequest;
  const workflow = await findComfyUIWorkflow(body.workflowId);

  if (!workflow) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  const updatedWorkflowJson = patchWorkflow(workflow.workflow_json, body.width, body.height, body.quality);
  let postResult: unknown = null;

  try {
    postResult = await postToComfyUI(workflow.server_url, updatedWorkflowJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase.from('system_logs').insert({
      log_type: 'generation',
      message: `Failed ComfyUI generation request for workflow ${workflow.id}`,
      level: 'error',
      details: {
        workflowId: workflow.id,
        providerId: workflow.provider_id,
        server_url: workflow.server_url,
        error: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await supabase.from('generation_jobs').insert({
    prompt: body.prompt,
    model: body.model,
    status: 'queued',
    progress: 0,
    current_node: 'Awaiting execution',
    provider_id: workflow.provider_id,
    eta_seconds: 0,
  });

  await supabase.from('system_logs').insert({
    log_type: 'generation',
    message: `Started ComfyUI generation for workflow ${workflow.workflow_name}`,
    level: 'info',
    details: {
      workflowId: workflow.id,
      providerId: workflow.provider_id,
      server_url: workflow.server_url,
      prompt: body.prompt,
      model: body.model,
      width: body.width,
      height: body.height,
    },
  });

  return NextResponse.json({ success: true, result: postResult });
}
