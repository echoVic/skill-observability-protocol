/** STOP Protocol type definitions */

export interface SkillManifest {
  sop: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  tags?: string[];
  inputs?: InputField[];
  outputs?: OutputField[];
  tools_used?: string[];
  side_effects?: SideEffect[];
  requirements?: Requirements;
  assertions?: Assertions;
  observability?: ObservabilityConfig;
}

export interface InputField {
  name: string;
  type: FieldType;
  required?: boolean;
  description?: string;
  default?: any;
  constraints?: {
    pattern?: string;
    enum?: any[];
    min?: number;
    max?: number;
  };
}

export interface OutputField {
  name: string;
  type: FieldType;
  description?: string;
  guaranteed?: boolean;
}

export type FieldType = 'string' | 'number' | 'boolean' | 'file_path' | 'dir_path' | 'url' | 'json' | 'array' | 'enum';

export interface SideEffect {
  type: 'filesystem' | 'network' | 'message' | 'exec' | 'state';
  access?: 'read' | 'write' | 'delete';
  description?: string;
  paths?: string[];
  destinations?: string[];
}

export interface Requirements {
  env_vars?: string[];
  files?: string[];
  tools?: string[];
  capabilities?: string[];
}

export interface Assertions {
  pre?: AssertionRule[];
  post?: AssertionRule[];
}

export interface AssertionRule {
  check: string;
  severity?: 'error' | 'warn';
  message?: string;
  // check-specific fields
  name?: string;
  path?: string;
  pattern?: string;
  tool?: string;
  command?: string;
  exit_code?: number;
  url_pattern?: string;
  matches?: string;
  equals?: any;
  not_empty?: boolean;
  greater_than?: number;
  max_ms?: number;
}

export interface AssertionResult {
  check: string;
  status: 'pass' | 'fail';
  severity: 'error' | 'warn';
  message?: string;
  value?: any;
}

export interface ObservabilityConfig {
  level?: 'L0' | 'L1' | 'L2' | 'L3';
  trace_sampling?: number;
  metrics?: MetricDef[];
}

export interface MetricDef {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description?: string;
}

// Trace types
export interface Span {
  span_id: string;
  trace_id: string;
  parent_span_id?: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  kind: SpanKind;
  name: string;
  status: 'ok' | 'error' | 'skipped';
  attributes: Record<string, any>;
  events?: SpanEvent[];
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
}

export type SpanKind =
  | 'skill.execute'
  | 'skill.input'
  | 'skill.output'
  | 'tool.call'
  | 'tool.result'
  | 'file.read'
  | 'file.write'
  | 'http.request'
  | 'llm.reason'
  | 'assertion.check'
  | 'branch'
  | 'custom';

export interface SpanEvent {
  timestamp: string;
  name: string;
  attributes?: Record<string, any>;
}

/** Context passed to assertion checks */
export interface CheckContext {
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  env?: Record<string, string | undefined>;
  tools?: string[];
  duration_ms?: number;
}
