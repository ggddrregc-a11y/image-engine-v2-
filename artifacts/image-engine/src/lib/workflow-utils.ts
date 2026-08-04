const clampCfg = (value: number) => Math.min(1.5, Math.max(1.0, value));
const resolveQualitySteps = (quality: 'standard' | 'high') =>
  quality === 'high' ? 9 : 4;
const generateSeed = () => Math.floor(Math.random() * 0x7fffffff);

/**
 * Patches a ComfyUI workflow JSON with the given generation parameters.
 * Returns a new workflow object ready to send to ComfyUI's /prompt endpoint.
 */
export function patchWorkflow(
  workflowJson: Record<string, unknown>,
  width: number,
  height: number,
  quality: 'standard' | 'high',
  promptText: string,
): Record<string, unknown> {
  const updated = { ...workflowJson };
  const qualitySteps = resolveQualitySteps(quality);
  const seed = generateSeed();

  for (const [nodeId, nodeData] of Object.entries(updated)) {
    if (typeof nodeData !== 'object' || nodeData === null) continue;
    const node = nodeData as Record<string, unknown>;
    const classType = String(node.class_type ?? '');
    const inputs = node.inputs as Record<string, unknown> | undefined;
    if (!inputs) continue;

    const isLatentImage =
      classType.includes('EmptySD3LatentImage') ||
      classType.includes('EmptyLatentImage');
    const isModelSampler =
      classType.includes('KSampler') || nodeId === 'KSamplerSelect';
    const hasPromptField =
      'prompt' in inputs ||
      'positive_prompt' in inputs ||
      'positive' in inputs ||
      'text' in inputs;

    if (isLatentImage) {
      updated[nodeId] = {
        ...node,
        inputs: { ...inputs, width, height },
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
}
