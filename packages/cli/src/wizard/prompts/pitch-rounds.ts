export interface RoundConfig {
  round: number;
  focus: string;
  systemAddendum: string;
}

export const PITCH_ROUNDS: RoundConfig[] = [
  {
    round: 1,
    focus: 'Story Premise & User Outcome',
    systemAddendum: `This is round 1. Establish the narrative and operating context. Capture: primary user persona, triggering pain event, desired outcome, and key constraints. Ask one question that converts a vague idea into a concrete user-outcome statement.`,
  },
  {
    round: 2,
    focus: 'Evidence & Baseline',
    systemAddendum: `This is round 2. Ground the story in evidence. Capture current alternatives, baseline metrics (time, cost, quality, or error), and why users would switch. Ask one question that yields a measurable baseline or proof source.`,
  },
  {
    round: 3,
    focus: 'Verifiable Goals & Missions',
    systemAddendum: `This is round 3. Define execution targets. Capture 2-4 measurable 30-day goals, then draft the first 3 missions with clear definition-of-done and success thresholds. Ask one question that clarifies a missing metric, owner, or deadline.`,
  },
  {
    round: 4,
    focus: 'Agent Team & Handoffs',
    systemAddendum: `This is round 4. Design a lean agent team (3-6 agents) around mission ownership. Clarify responsibilities, handoff rules, escalation paths, and one failure-recovery protocol. Ask one question that removes role overlap or handoff ambiguity.`,
  },
  {
    round: 5,
    focus: 'Mission Backlog & Task Graph',
    systemAddendum: `This is round 5. Convert missions into executable work. Define high-priority tasks, dependencies, trigger events, and acceptance criteria so agents can act autonomously. Ask one question that unlocks backlog prioritization or sequencing.`,
  },
  {
    round: 6,
    focus: 'Execution Contract',
    systemAddendum: `This is round 6 (final). Finalize an execution contract: first-week plan, KPI cadence, and single biggest unresolved risk with mitigation owner. Ask one question that secures a concrete commitment. End by saying you're ready to synthesize.`,
  },
];
