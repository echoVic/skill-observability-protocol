import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { Span, SpanKind, SpanEvent, SkillManifest } from '../types.js';

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function now(): string {
  return new Date().toISOString();
}

export class Tracer {
  readonly traceId: string;
  private spans: Span[] = [];
  private manifest: SkillManifest;
  private rootSpan: Span;

  constructor(manifest: SkillManifest) {
    this.manifest = manifest;
    this.traceId = genId('t');
    this.rootSpan = {
      span_id: genId('s'),
      trace_id: this.traceId,
      kind: 'skill.execute',
      name: manifest.name,
      start_time: now(),
      status: 'ok',
      attributes: {
        'skill.name': manifest.name,
        'skill.version': manifest.version,
        'sop.level': manifest.observability?.level ?? 'L0',
      },
    };
    this.spans.push(this.rootSpan);
  }

  /** Get the root span ID (for creating child spans) */
  get rootSpanId(): string {
    return this.rootSpan.span_id;
  }

  /** Start a new child span, returns span_id */
  startSpan(kind: SpanKind, name: string, parentSpanId?: string, attributes?: Record<string, any>): string {
    const span: Span = {
      span_id: genId('s'),
      trace_id: this.traceId,
      parent_span_id: parentSpanId ?? this.rootSpan.span_id,
      kind,
      name,
      start_time: now(),
      status: 'ok',
      attributes: attributes ?? {},
    };
    this.spans.push(span);
    return span.span_id;
  }

  /** End a span with status and optional attributes */
  endSpan(spanId: string, status?: 'ok' | 'error' | 'skipped', attributes?: Record<string, any>, error?: { type: string; message: string; stack?: string }) {
    const span = this.spans.find(s => s.span_id === spanId);
    if (!span) return;

    span.end_time = now();
    span.duration_ms = new Date(span.end_time).getTime() - new Date(span.start_time).getTime();
    if (status) span.status = status;
    if (attributes) Object.assign(span.attributes, attributes);
    if (error) span.error = error;
  }

  /** Add an event to a span */
  addEvent(spanId: string, name: string, attributes?: Record<string, any>) {
    const span = this.spans.find(s => s.span_id === spanId);
    if (!span) return;

    const event: SpanEvent = { timestamp: now(), name };
    if (attributes) event.attributes = attributes;
    if (!span.events) span.events = [];
    span.events.push(event);
  }

  /** Finish the root span */
  finish(status?: 'ok' | 'error') {
    this.rootSpan.end_time = now();
    this.rootSpan.duration_ms = new Date(this.rootSpan.end_time).getTime() - new Date(this.rootSpan.start_time).getTime();
    if (status) this.rootSpan.status = status;
  }

  /** Get all spans */
  getSpans(): Span[] {
    return [...this.spans];
  }

  /** Export trace as NDJSON string */
  toNDJSON(): string {
    return this.spans.map(s => JSON.stringify(s)).join('\n') + '\n';
  }

  /** Write trace to .sop/traces/ directory */
  writeTo(dir?: string): string {
    const baseDir = dir ?? path.join(process.cwd(), '.sop', 'traces');
    fs.mkdirSync(baseDir, { recursive: true });

    const ts = this.rootSpan.start_time.replace(/[:.]/g, '').slice(0, 15) + 'Z';
    const filename = `${ts}_${this.manifest.name}_${this.traceId}.jsonl`;
    const filePath = path.join(baseDir, filename);

    fs.writeFileSync(filePath, this.toNDJSON(), 'utf-8');
    return filePath;
  }
}

/** Create a tracer for a skill manifest */
export function createTracer(manifest: SkillManifest): Tracer {
  return new Tracer(manifest);
}
