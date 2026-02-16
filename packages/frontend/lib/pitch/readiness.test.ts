import { describe, expect, it } from 'vitest';
import { assessBuildReadiness } from './readiness';

describe('assessBuildReadiness', () => {
  it('marks transcript as ready when key build inputs are present', () => {
    const assessment = assessBuildReadiness([
      {
        founderInput:
          'Our target customer is a content agency owner. They start using us when a client asks for a weekly campaign and their team is overloaded.',
        vcResponse: 'What baseline are they using today and what should improve first?',
      },
      {
        founderInput:
          'Today they run it manually in Notion and Google Docs and it takes 12 hours per client per week.',
        vcResponse: 'What measurable outcome do they need in the first week?',
      },
      {
        founderInput:
          'Within 7 days they need to reduce production time by 50% and increase output from 4 to 8 posts.',
        vcResponse: 'Who owns each mission and what is the first task backlog?',
      },
      {
        founderInput:
          'Editor agent owns drafting, QA agent owns review, and PM agent handles handoffs. First backlog: onboarding flow, brief parser, and acceptance checklist with KPI tracking.',
        vcResponse: 'Good. This is close to build-ready.',
      },
    ]);

    expect(assessment.ready).toBe(true);
    expect(assessment.score).toBeGreaterThanOrEqual(4);
    expect(assessment.missing).toHaveLength(0);
  });

  it('keeps transcript unready when details are vague', () => {
    const assessment = assessBuildReadiness([
      {
        founderInput: 'We want to help teams make better marketing.',
        vcResponse: 'Who exactly and what triggers usage?',
      },
      {
        founderInput: 'Not sure yet, maybe startups. We will figure it out.',
        vcResponse: 'What measurable target do they need in week one?',
      },
    ]);

    expect(assessment.ready).toBe(false);
    expect(assessment.missing.length).toBeGreaterThan(0);
  });
});
