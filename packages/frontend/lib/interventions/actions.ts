export type InterventionStatus = 'open' | 'acknowledged' | 'resolved';
export type InterventionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InterventionAction = 'acknowledge' | 'retry' | 'reassign' | 'resolve';

export interface ParsedInterventionAction {
  action: InterventionAction;
  assignee?: string;
  note?: string;
}

export function parseInterventionActionRequest(value: unknown): ParsedInterventionAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const rawAction = record.action;
  if (
    rawAction !== 'acknowledge' &&
    rawAction !== 'retry' &&
    rawAction !== 'reassign' &&
    rawAction !== 'resolve'
  ) {
    return null;
  }

  const assignee =
    typeof record.assignee === 'string' && record.assignee.trim().length > 0
      ? record.assignee.trim()
      : undefined;
  const note =
    typeof record.note === 'string' && record.note.trim().length > 0
      ? record.note.trim()
      : undefined;

  if (rawAction === 'reassign' && !assignee) {
    return null;
  }

  return {
    action: rawAction,
    assignee,
    note,
  };
}
