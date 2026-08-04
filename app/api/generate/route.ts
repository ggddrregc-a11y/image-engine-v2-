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
  promptText: string,
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
    const hasPromptField = 'prompt' in inputs || 'positive_prompt' in inputs || 'positive' in inputs || 'text' in inputs;

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

    if (hasPromptField) {
      updated[nodeId] = {
        ...node,
        inputs: {
          ...inputs,
          prompt: promptText,
          positive_prompt: promptText,
          positive: promptText,
          text: promptText,
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
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch (err) {
    console.log('[api/generate] invalid request body', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  console.log('[api/generate] received request', {
    workflowId: body.workflowId,
    prompt: body.prompt,
    model: body.model,
    width: body.width,
    height: body.height,
  });

  const workflow = await findComfyUIWorkflow(body.workflowId);

  if (!workflow) {
    console.log('[api/generate] workflow not found', { workflowId: body.workflowId });
    console.log('[api/generate] workflow not found', { workflowId: body.workflowId });
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  console.log('[api/generate] fetched workflow from Supabase', { workflowId: workflow.id, workflowName: workflow.workflow_name, server_url: workflow.server_url });

  let storedWorkflowJson: Record<string, unknown>;
  try {
    storedWorkflowJson = typeof workflow.workflow_json === 'string' ? JSON.parse(workflow.workflow_json) : workflow.workflow_json;
  } catch (err) {
    console.log('[api/generate] failed to parse workflow_json', err);
    return NextResponse.json({ error: 'Invalid workflow_json stored for workflow' }, { status: 500 });
  }

  const updatedWorkflowJson = patchWorkflow(storedWorkflowJson, body.width, body.height, body.quality, body.prompt);
  let postResult: unknown = null;

  try {
    console.log('[api/generate] sending request to ComfyUI', { serverUrl: workflow.server_url });
    postResult = await postToComfyUI(workflow.server_url, updatedWorkflowJson);
    console.log('[api/generate] ComfyUI responded', postResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log('[api/generate] ComfyUI request failed', message);
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
