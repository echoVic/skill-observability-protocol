# STOP Spec: Observability Levels

> Version: 0.1.0-draft

## Overview

STOP defines four observability levels (L0–L3) for progressive adoption. A skill author picks the level that matches their needs — start simple, add more as the skill matures.

The key principle: **L0 costs nothing but a YAML file. Each level adds value proportional to its effort.**

## Levels

### L0 — Manifest

**Effort:** Write one `skill.yaml` file.
**You get:** Static analysis, dependency auditing, side-effect visibility.

```
my-skill/
├── SKILL.md
└── skill.yaml    ← just this
```

At L0, the manifest is purely declarative. No runtime behavior changes. But it already enables:

- **Skill discovery** — platforms can index skills by inputs, outputs, tags
- **Security audit** — reviewers see what tools and side effects a skill declares
- **Compatibility check** — runtimes can verify requirements before execution
- **Composition planning** — output types of one skill can match input types of another

### L1 — Trace

**Effort:** Runtime emits spans automatically (no skill author work if runtime supports STOP).
**You get:** Execution timeline, tool call visibility, duration tracking.

Everything in L0, plus:

- **Execution trace** — see exactly what happened and in what order
- **Duration breakdown** — which step took the most time
- **Error localization** — pinpoint which span failed
- **Tool call audit** — verify the skill only used declared tools

L1 is typically implemented by the runtime, not the skill author. If your runtime supports STOP, you get L1 for free by declaring `observability.level: L1` in the manifest.

### L2 — Assertions

**Effort:** Write pre/post-condition assertions in `skill.yaml`.
**You get:** Automated success verification, trust scoring, regression detection.

Everything in L1, plus:

- **Pre-condition checks** — fail fast if environment isn't ready
- **Post-condition checks** — verify the skill actually produced correct results
- **Trust score** — historical pass rate gives users confidence signals
- **Regression detection** — assertions that used to pass but now fail

L2 is where observability becomes actionable. It's the difference between "the skill ran" and "the skill worked."

### L3 — Full

**Effort:** Define custom metrics, cost tracking, anomaly baselines.
**You get:** Production-grade monitoring, cost visibility, anomaly alerts.

Everything in L2, plus:

- **Custom metrics** — counters, gauges, histograms for skill-specific KPIs
- **Cost tracking** — token usage, API call costs, compute time
- **Anomaly detection** — baseline normal behavior, alert on deviations
- **SLA monitoring** — track success rate and latency against targets

L3 is for skills running in production at scale. Most skills won't need this.

## Comparison

| Capability | L0 | L1 | L2 | L3 |
|-----------|----|----|----|----|
| Manifest (`skill.yaml`) | ✅ | ✅ | ✅ | ✅ |
| Static analysis | ✅ | ✅ | ✅ | ✅ |
| Side-effect declaration | ✅ | ✅ | ✅ | ✅ |
| Execution traces | — | ✅ | ✅ | ✅ |
| Duration tracking | — | ✅ | ✅ | ✅ |
| Error localization | — | ✅ | ✅ | ✅ |
| Pre-conditions | — | — | ✅ | ✅ |
| Post-conditions | — | — | ✅ | ✅ |
| Trust score | — | — | ✅ | ✅ |
| Custom metrics | — | — | — | ✅ |
| Cost tracking | — | — | — | ✅ |
| Anomaly detection | — | — | — | ✅ |

## Choosing a Level

```
Is this a personal/internal skill?
  → L0 (manifest only)

Do you need to debug failures?
  → L1 (add tracing)

Do users/platforms need to trust this skill?
  → L2 (add assertions)

Is this running in production at scale?
  → L3 (add metrics + monitoring)
```

## Runtime Responsibilities by Level

| Level | Runtime MUST | Runtime SHOULD |
|-------|-------------|----------------|
| L0 | Parse and validate `skill.yaml` | Warn on undeclared tool usage |
| L1 | Emit root + child spans | Forward traces to collectors |
| L2 | Run pre/post assertions, emit results | Compute trust scores |
| L3 | Collect custom metrics | Detect anomalies, enforce SLAs |

## Migration Path

Levels are additive. Moving from L1 to L2 means adding assertions to your existing manifest — nothing else changes. There's no migration cost, only incremental value.
