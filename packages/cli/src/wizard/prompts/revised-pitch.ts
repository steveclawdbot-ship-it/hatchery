export const REVISED_PITCH_PROMPT = `Based on the entire pitch meeting transcript below, produce a REVISED PITCH in this exact structure:

REVISED PITCH
─────────────
Original idea: [1-2 sentences of what was pitched]
What changed: [key pivots, additions, or refinements from the meeting]
Final concept: [the improved, post-meeting version in 2-3 sentences]

Target customer: [specific persona with demographics/psychographics]
Revenue model: [how it makes money, with pricing if discussed]
Unfair advantage: [what makes this defensible]

Proposed agent team:
- [Agent Name] (role): [what they do, their personality angle]
[repeat for each agent, 3-6 agents]

Agent dynamics:
- [tension pair or collaboration pattern worth noting]
[2-3 dynamics]

Key risks:
1. [risk] → [mitigation]
2. [risk] → [mitigation]
3. [risk] → [mitigation]

Verifiable 30-day goals:
1. [goal with metric + target + date]
2. [goal with metric + target + date]
3. [goal with metric + target + date]

Initial mission queue:
1. [mission name] - owner: [agent/person] - done when: [verifiable condition]
2. [mission name] - owner: [agent/person] - done when: [verifiable condition]
3. [mission name] - owner: [agent/person] - done when: [verifiable condition]

Priority task backlog:
- [task] - supports mission: [name] - dependency: [if any] - acceptance: [testable outcome]
- [task] - supports mission: [name] - dependency: [if any] - acceptance: [testable outcome]
- [task] - supports mission: [name] - dependency: [if any] - acceptance: [testable outcome]

30-day validation plan:
1. [action]
2. [action]
3. [action]

Be specific. No hand-waving. If the meeting didn't address something, flag it as a gap.`;
