import { BillingRequestStatus, Role } from '@prisma/client';
import {
  availableActions,
  isEditable,
  isTerminal,
  WORKFLOW_ACTIONS,
} from './workflow';

describe('billing-request workflow (state machine)', () => {
  describe('WORKFLOW_ACTIONS transition table', () => {
    it('submit moves DRAFT -> SUBMITTED and is owner-only for SALES', () => {
      const def = WORKFLOW_ACTIONS.submit;
      expect(def.from).toBe(BillingRequestStatus.DRAFT);
      expect(def.to).toBe(BillingRequestStatus.SUBMITTED);
      expect(def.allowedRoles).toEqual([Role.SALES]);
      expect(def.requiresOwnership).toBe(true);
    });

    it('approve moves SUBMITTED -> APPROVED for ACCOUNTS without ownership', () => {
      const def = WORKFLOW_ACTIONS.approve;
      expect(def.from).toBe(BillingRequestStatus.SUBMITTED);
      expect(def.to).toBe(BillingRequestStatus.APPROVED);
      expect(def.allowedRoles).toEqual([Role.ACCOUNTS]);
      expect(def.requiresOwnership).toBe(false);
    });

    it('reject moves SUBMITTED -> REJECTED for ACCOUNTS', () => {
      const def = WORKFLOW_ACTIONS.reject;
      expect(def.from).toBe(BillingRequestStatus.SUBMITTED);
      expect(def.to).toBe(BillingRequestStatus.REJECTED);
      expect(def.allowedRoles).toEqual([Role.ACCOUNTS]);
    });

    it('resubmit moves REJECTED -> DRAFT for the owning SALES user', () => {
      const def = WORKFLOW_ACTIONS.resubmit;
      expect(def.from).toBe(BillingRequestStatus.REJECTED);
      expect(def.to).toBe(BillingRequestStatus.DRAFT);
      expect(def.requiresOwnership).toBe(true);
    });
  });

  describe('availableActions', () => {
    it('offers only submit from DRAFT', () => {
      expect(availableActions(BillingRequestStatus.DRAFT)).toEqual(['submit']);
    });

    it('offers approve and reject from SUBMITTED', () => {
      expect(availableActions(BillingRequestStatus.SUBMITTED).sort()).toEqual([
        'approve',
        'reject',
      ]);
    });

    it('offers resubmit from REJECTED', () => {
      expect(availableActions(BillingRequestStatus.REJECTED)).toEqual([
        'resubmit',
      ]);
    });

    it('offers no actions from APPROVED (handled asynchronously) or INVOICED', () => {
      expect(availableActions(BillingRequestStatus.APPROVED)).toEqual([]);
      expect(availableActions(BillingRequestStatus.INVOICED)).toEqual([]);
    });
  });

  describe('status predicates', () => {
    it('only DRAFT is editable', () => {
      expect(isEditable(BillingRequestStatus.DRAFT)).toBe(true);
      expect(isEditable(BillingRequestStatus.SUBMITTED)).toBe(false);
      expect(isEditable(BillingRequestStatus.INVOICED)).toBe(false);
    });

    it('only INVOICED is terminal', () => {
      expect(isTerminal(BillingRequestStatus.INVOICED)).toBe(true);
      expect(isTerminal(BillingRequestStatus.APPROVED)).toBe(false);
    });
  });
});
