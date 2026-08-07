export type ViewId =
  | 'generate'
  | 'editor'
  | 'gallery'
  | 'history'
  | 'collections'
  | 'workflows'
  | 'models'
  | 'api'
  | 'chat'
  | 'settings'
  | 'admin'
  | 'videos'
  | 'videos-admin';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  sampler: string;
  seed: number;
  createdAt: string;
  favorite: boolean;
  collectionId?: string;
  status: 'complete' | 'generating' | 'failed';
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  count: number;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  label: string;
  prompt: string;
  category: string;
}

export interface GenerationJob {
  id: string;
  prompt: string;
  model: string;
  status: 'queued' | 'running' | 'complete' | 'failed' | 'canceled';
  progress: number;
  currentNode?: string;
  startedAt: string;
  etaSeconds?: number;
  imageId?: string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  nodes: number;
  category: string;
  updatedAt: string;
  active: boolean;
}

export interface ModelDef {
  id: string;
  name: string;
  base: string;
  type: 'checkpoint' | 'lora' | 'vae' | 'controlnet';
  size: string;
  downloads: number;
  likes: number;
  tags: string[];
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  prompt: string;
  model: string;
  status: 'complete' | 'failed' | 'canceled';
  durationSeconds: number;
  createdAt: string;
  imageId?: string;
}
