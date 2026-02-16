import { describe, expect, it } from 'vitest';
import { parseInterventionActionRequest } from './actions';

describe('intervention action parsing', () => {
  it('parses valid acknowledge action', () => {
    expect(parseInterventionActionRequest({ action: 'acknowledge' })).toEqual({
      action: 'acknowledge',
      assignee: undefined,
      note: undefined,
    });
  });

  it('requires assignee for reassign action', () => {
    expect(parseInterventionActionRequest({ action: 'reassign' })).toBeNull();
    expect(parseInterventionActionRequest({
      action: 'reassign',
      assignee: 'ops-1',
    })).toEqual({
      action: 'reassign',
      assignee: 'ops-1',
      note: undefined,
    });
  });

  it('rejects unknown actions', () => {
    expect(parseInterventionActionRequest({ action: 'close' })).toBeNull();
  });
});
