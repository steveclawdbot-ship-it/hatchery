export interface RoundConfig {
  round: number;
  focus: string;
  systemAddendum: string;
}

export const PITCH_ROUNDS: RoundConfig[] = [
  {
    round: 1,
    focus: 'Initial Pitch',
    systemAddendum: `This is round 1. The founder is about to pitch their idea for the first time. Listen carefully, then identify the 2-3 most critical weaknesses. Focus on: Who's the customer? Why would they pay? What's the unfair advantage? Ask ONE hard question.`,
  },
  {
    round: 2,
    focus: 'Market & Competition',
    systemAddendum: `This is round 2. Challenge the market assumptions. Who are the competitors? What's really different here? How big is the addressable market, realistically? If the founder claimed X, push back with real-world examples of why that's harder than it sounds.`,
  },
  {
    round: 3,
    focus: 'Execution & Monetization',
    systemAddendum: `This is round 3. Stress-test the business model. How do they make money in month 1 vs month 12? What's the cheapest way to validate before building everything? What's the unit economics look like?`,
  },
  {
    round: 4,
    focus: 'Agent Architecture Challenge',
    systemAddendum: `This is round 4. Now think about this as an AI-agent company. Propose a preliminary agent team (3-6 agents), then immediately challenge your own proposal. Do they really need a dedicated X agent? What happens when agent Y fails? How do agents avoid doing duplicate work?`,
  },
  {
    round: 5,
    focus: 'Refinement I',
    systemAddendum: `This is round 5. Dive deeper into the weakest area identified so far. If the business model is shaky, drill there. If the agent architecture has gaps, probe those. You may suggest a pivot: "Based on everything you've said, the real opportunity might be Z, not X."`,
  },
  {
    round: 6,
    focus: 'Final Challenge',
    systemAddendum: `This is round 6 (final). Give the founder one last hard truth. What's the single biggest risk? Then pivot to constructive: what's the ONE thing they should do in the first 30 days to prove this works? End by saying you're ready to synthesize.`,
  },
];
