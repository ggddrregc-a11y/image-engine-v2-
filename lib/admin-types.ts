export type ProviderType =
  | 'comfyui'
  | 'openai'
  | 'ollama'
  | 'stability'
  | 'huggingface'
  | 'custom';

export type AuthType =
  | 'none'
  | 'api_key'
  | 'bearer'
  | 'custom_headers'
  | 'basic'
  | 'cookie';

export type ModelType = 'image' | 'text' | 'video' | 'audio';

export type JobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'canceled';

export type LogType = 'api' | 'generation' | 'error' | 'webhook' | 'connection';
export type LogLevel = 'info' | 'warning' | 'error';

export type UserRole = 'super_admin' | 'admin' | 'moderator' | 'user' | 'guest';

export interface AIProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  enabled: boolean;
  priority: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ComfyUIWorkflow {
  id: string;
  provider_id: string | null;
  server_url: string;
  workflow_name: string;
  workflow_json: Record<string, unknown>;
  input_nodes: WorkflowNode[];
  output_nodes: WorkflowNode[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  title: string;
  class_type?: string;
}

export interface ApiConfig {
  id: string;
  provider_id: string;
  auth_type: AuthType;
  endpoint_path: string;
  headers: Record<string, string>;
  request_body: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider_id: string | null;
  model_type: ModelType;
  enabled: boolean;
  is_default: boolean;
  max_resolution: string;
  max_steps: number;
  sampler: string;
  scheduler: string;
  cfg: number;
  seed_mode: string;
  custom_params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplateDB {
  id: string;
  name: string;
  prompt_text: string;
  category: string;
  negative_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationSettings {
  id: string;
  width: number;
  height: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  seed: string;
  steps: number;
  batch_count: number;
  batch_size: number;
  negative_prompt: string;
  safety_filter: boolean;
  watermark: boolean;
  save_metadata: boolean;
  updated_at: string;
}

export interface GenerationJobDB {
  id: string;
  prompt: string;
  model: string;
  status: JobStatus;
  progress: number;
  current_node: string;
  provider_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  eta_seconds: number;
  error_message: string;
  image_url: string;
  created_at: string;
}

export interface StoredImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  favorite: boolean;
  tags: string[];
  created_at: string;
}

export interface SystemLog {
  id: string;
  log_type: LogType;
  message: string;
  details: Record<string, unknown>;
  level: LogLevel;
  created_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  authStatus: 'authenticated' | 'failed' | 'not_required';
  version?: string;
  availableModels?: string[];
  error?: string;
}
