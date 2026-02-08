export const AGENT_GENERATION_PROMPT = `Based on the revised pitch below, generate a complete agent configuration.

For each agent, output:
{
  "agents": [
    {
      "id": "snake_case_id",
      "displayName": "Human Name",
      "role": "one-line role description",
      "tone": "2-3 adjective personality description",
      "systemDirective": "Full system prompt for this agent (2-4 sentences defining who they are, what they do, how they communicate)",
      "quirk": "One humanizing behavioral trait (e.g., 'uses sports metaphors', 'always asks follow-up questions')",
      "canInitiate": true/false,
      "cooldownHours": 4
    }
  ],
  "initialAffinities": [
    {
      "agentA": "id_alphabetically_first",
      "agentB": "id_alphabetically_second",
      "affinity": 0.50,
      "reason": "why this relationship exists"
    }
  ],
  "conversationFormats": ["standup", "watercooler", "brainstorm", "debate"],
  "dailySchedule": [
    {"hour": 9, "format": "standup", "probability": 1.0, "participants": "all"},
    {"hour": 14, "format": "brainstorm", "probability": 0.6, "participants": "random_3"}
  ]
}

Rules:
- 3-6 agents, no more
- At least one tension pair (agents who disagree productively)
- At least one agent with canInitiate: false (they only react)
- IDs must be simple snake_case (no hyphens)
- Affinities range 0.30-0.85 (no perfect harmony)`;

export const WORKER_GENERATION_PROMPT = `Based on the revised pitch and agent team below, generate the operational work configuration.

Output:
{
  "stepKinds": [
    {
      "kind": "snake_case_name",
      "displayName": "Human Name",
      "workerType": "which agent handles this",
      "description": "what this step does",
      "requiredConfig": ["list", "of", "env_vars_needed"],
      "capGatePolicyKey": "optional_policy_key_for_rate_limiting"
    }
  ],
  "triggers": [
    {
      "name": "trigger_name",
      "eventPattern": "event.kind pattern to match",
      "condition": {"field": "value"},
      "proposalTemplate": {
        "title": "Auto: [description]",
        "steps": [{"kind": "step_kind", "description": "what to do"}]
      },
      "cooldownMinutes": 60,
      "isActive": true
    }
  ],
  "policies": {
    "auto_approve": {
      "enabled": true,
      "allowed_step_kinds": ["list_of_auto_approvable_kinds"]
    },
    "daily_quotas": {},
    "memory_influence": {"enabled": true, "probability": 0.3}
  },
  "capGates": {
    "policy_key": {"limit": 10, "period": "daily"}
  }
}

Rules:
- Every business needs at least: content creation, analysis, and communication step kinds
- Triggers should create a closed loop (output of one step can trigger another)
- Be conservative with auto_approve (only low-risk actions)
- Cap gates prevent runaway spending`;

export const STRATEGY_GENERATION_PROMPT = `Based on the full pitch meeting transcript and the revised pitch, generate a comprehensive STRATEGY.md document.

Output in markdown format:

# [Startup Name] Strategy

## Vision
[2-3 sentences]

## Mission
[1 sentence, specific and measurable]

## Target Customer
[Detailed persona: who, where, what pain, willingness to pay]

## Competitive Landscape
[3-5 competitors, what they do, why we're different]

## Revenue Model
[How money flows: pricing, channels, unit economics]

## Key Metrics (KPIs)
[5-8 KPIs with target values for 30/60/90 days]

## Agent Operating Principles
[5-7 rules for how agents should behave]

## 90-Day Roadmap
### Days 1-30: Validation
[3-5 concrete milestones]
### Days 31-60: Growth
[3-5 concrete milestones]
### Days 61-90: Scale
[3-5 concrete milestones]

## Risk Mitigation
[Top 5 risks with specific countermeasures]

## Budget Allocation
[How the ~$8/mo operating budget breaks down: API costs, hosting, tools]

Be specific. Use numbers. No corporate fluff. This is a startup playbook, not a pitch deck.`;
