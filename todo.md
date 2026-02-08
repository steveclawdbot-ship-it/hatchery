# Hatchery MVP Build Contract

> Last updated: 2026-02-08  
> Horizon: 7 days  
> Goal: ship a functional MVP, not a commercialized product

## 1. Locked Product Decisions

- [x] Deployment target is `Vercel + Supabase`
- [x] Single-tenant is acceptable for MVP
- [x] Billing is out of scope for week 1
- [x] User provides own API keys (BYOK)
- [x] Dashboard is the primary interface
- [x] Core loop is `goal -> plan -> execute -> validate -> replan`
- [x] One active mission at a time per company
- [x] One primary outcome metric per company
- [x] Manual approvals are off by default
- [x] External posting is optional, with X first

## 2. MVP Scope

### 2.1 In-Scope Templates

- [ ] Research company
- [ ] Back-office admin company
- [ ] Creative agency

### 2.2 In-Scope Built-In Step Kinds

- [x] `research`
- [x] `draft`
- [x] `review`
- [x] `publish_x`
- [x] `analyze_results`

### 2.3 Runtime Defaults

- [x] Max loops/day: `24`
- [x] Max posts/day: `5`
- [ ] Step timeout: `15m`
- [x] Max retries/step: `2`
- [x] Escalate after `3` consecutive mission failures
- [x] Polling interval: `5 minutes`
- [ ] Event retention target: `30 days`

## 3. Explicit Non-Goals (Week 1)

- [ ] No full multi-tenant isolation
- [ ] No Stripe/billing
- [ ] No role-based access control
- [ ] No conversation replay UI
- [ ] No relationship graph UI
- [ ] No full memory browser UI
- [ ] No heavy pixel-office simulation
- [ ] No dynamic tool/runtime generation beyond a generic executor fallback

## 4. UI Contract

### 4.1 Active Views

- [x] `Control Panel`
- [x] `Mission Feed`

### 4.2 Disabled Views

- [x] Show `Coming soon` stubs for deferred modules
- [x] Never allow disabled modules to issue real actions
- [ ] If demo data appears, show clear `Demo Mode` indicator

### 4.3 Required Control Panel Actions

- [x] Set company template
- [x] Set primary metric, target, deadline, and budget
- [x] Set loop and posting limits
- [x] `Run now`
- [x] `Pause`
- [x] `Resume`
- [x] `Stop all`

### 4.4 Stop/Resume Semantics

- [x] `Stop all` halts running work and blocks new planning
- [x] `Pause` halts planning/execution without terminating state
- [x] `Resume` restores normal loop execution

## 5. Data Contract (DB-Driven)

### 5.1 Required Policy Keys

- [x] `company_runtime_config`
- [x] `runtime_control`

### 5.2 `company_runtime_config` Shape

```json
{
  "companyTemplate": "research | back-office | creative",
  "metricName": "string",
  "targetValue": 25,
  "deadlineDays": 30,
  "budgetLimit": 100,
  "loopCapPerDay": 24,
  "postLimitPerDay": 5
}
```

### 5.3 `runtime_control` Shape

```json
{
  "mode": "running | paused | stopped",
  "pollingMinutes": 5,
  "updatedAt": "ISO timestamp"
}
```

## 6. Safety and Guardrails

- [x] Pre-publish content filter for X posting
- [x] If filter fails, auto-rewrite once
- [ ] If rewrite fails, create manual intervention task
- [x] Enforce hard daily posting cap
- [x] Enforce hard budget guardrail
- [x] Emit internal control and heartbeat events for visibility

## 7. Engineering Work Plan

### P0 - Must Ship

- [x] Unify runtime control handling across API endpoints
- [x] Ensure heartbeat obeys pause/stop state
- [x] Implement end-to-end mission execution for 5 built-ins
- [x] Add generic fallback for unknown step kinds
- [x] Ensure feed is polling-based and stable
- [x] Ensure dashboard actions map to real backend behavior
- [ ] Add critical-path tests for control actions and loop flow

### P1 - Should Ship

- [ ] Add template-specific starter prompts/policies
- [ ] Add X publishing with rate limit and retry strategy
- [ ] Add explicit failure escalation task creation
- [ ] Add lightweight “status widget” replacement for pixel office

### P2 - Defer

- [ ] Billing and plan management
- [ ] Multi-company auth/org model
- [ ] Advanced observability stack
- [ ] Full real-time SSE transport

## 8. Launch Readiness Gate

MVP is launchable only if all items below pass:

- [ ] Company can be spawned with one configured primary metric
- [ ] At least one mission completes the full loop automatically
- [ ] Pause, resume, stop, and run-now controls work in production
- [ ] Feed updates reliably via polling without crashing
- [ ] External publish path is safely bounded by policy and caps
- [ ] Critical-path tests and typecheck are green

## 9. Success Tracking (Post-Launch)

Week 1 target signals:

- [ ] Spawned companies (target to be set during rollout)
- [ ] Completed missions (target to be set during rollout)
- [ ] Weekly active companies (target to be set during rollout)
- [ ] Active sessions engaging with dashboard controls

If these are not achieved, iterate on control clarity and mission reliability before adding new surface area.
