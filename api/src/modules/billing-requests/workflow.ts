import { BillingRequestStatus, Role } from '@prisma/client';

/**
 * The billing-request workflow as an explicit, declarative state machine.
 *
 *   DRAFT --submit--> SUBMITTED --approve--> APPROVED --(async)--> INVOICED
 *                         \--reject--> REJECTED --resubmit--> DRAFT
 *
 * Keeping this pure (no framework/IO dependencies) means the rules can be
 * unit-tested in isolation and there is a single source of truth for "what
 * can happen next", reused by both the service and the API responses.
 */

export type WorkflowActionName =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'resubmit';

export interface WorkflowActionDefinition {
  /** The status a request must be in for this action to apply. */
  from: BillingRequestStatus;
  /** The status the request moves to. */
  to: BillingRequestStatus;
  /** Roles permitted to perform the action. */
  allowedRoles: Role[];
  /** Whether the actor must own (have created) the request. */
  requiresOwnership: boolean;
}

export const WORKFLOW_ACTIONS: Record<
  WorkflowActionName,
  WorkflowActionDefinition
> = {
  submit: {
    from: BillingRequestStatus.DRAFT,
    to: BillingRequestStatus.SUBMITTED,
    allowedRoles: [Role.SALES],
    requiresOwnership: true,
  },
  approve: {
    from: BillingRequestStatus.SUBMITTED,
    to: BillingRequestStatus.APPROVED,
    allowedRoles: [Role.ACCOUNTS],
    requiresOwnership: false,
  },
  reject: {
    from: BillingRequestStatus.SUBMITTED,
    to: BillingRequestStatus.REJECTED,
    allowedRoles: [Role.ACCOUNTS],
    requiresOwnership: false,
  },
  resubmit: {
    from: BillingRequestStatus.REJECTED,
    to: BillingRequestStatus.DRAFT,
    allowedRoles: [Role.SALES],
    requiresOwnership: true,
  },
};

/**
 * System transition (no human actor): performed by the async invoice worker
 * once a request is APPROVED. Kept separate from WORKFLOW_ACTIONS because it
 * is never invoked directly via the API.
 */
export const SYSTEM_INVOICE_TRANSITION = {
  from: BillingRequestStatus.APPROVED,
  to: BillingRequestStatus.INVOICED,
} as const;

/** A request is editable only while it is a DRAFT owned by its creator. */
export function isEditable(status: BillingRequestStatus): boolean {
  return status === BillingRequestStatus.DRAFT;
}

/** Terminal states have no further transitions. */
export function isTerminal(status: BillingRequestStatus): boolean {
  return status === BillingRequestStatus.INVOICED;
}

/**
 * Returns the action names that are structurally valid from a given status,
 * ignoring role/ownership. Useful for surfacing available actions to clients.
 */
export function availableActions(
  status: BillingRequestStatus,
): WorkflowActionName[] {
  return (Object.keys(WORKFLOW_ACTIONS) as WorkflowActionName[]).filter(
    (name) => WORKFLOW_ACTIONS[name].from === status,
  );
}
