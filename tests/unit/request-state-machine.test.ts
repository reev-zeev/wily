/**
 * الغرض: اختبارات وحدة لـ Request State Machine
 * الحالة: تنفيد فعلي
 */

import { describe, expect, test } from 'bun:test';
import { RequestStateMachine, validateTransition, getNextStates } from '@application/dispatch';

describe('RequestStateMachine', () => {
  describe('create', () => {
    test('creates machine in pending state', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');

      expect(sm.getState()).toBe('pending');
      expect(sm.getContext().requestId).toBe('req-123');
      expect(sm.getContext().riderId).toBe('rider-456');
      expect(sm.isTerminal()).toBe(false);
    });

    test('allows start_search transition from pending', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      const result = sm.transition('start_search');

      expect(result.ok).toBe(true);
      expect(result.value?.newState).toBe('searching');
    });

    test('allows cancel_by_rider from pending', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      const result = sm.transition('cancel_by_rider');

      expect(result.ok).toBe(true);
      expect(result.value?.newState).toBe('cancelled_by_rider');
      expect(sm.isTerminal()).toBe(true);
    });
  });

  describe('searching state', () => {
    test('can transition to offer_made', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      sm.transition('start_search');

      const result = sm.transition('make_offer', { offerId: 'offer-789' });

      expect(result.ok).toBe(true);
      expect(result.value?.newState).toBe('offer_made');
    });

    test('can transition to expired', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      sm.transition('start_search');

      const result = sm.transition('expire');

      expect(result.ok).toBe(true);
      expect(result.value?.newState).toBe('expired');
    });

    test('can transition to cancelled_by_rider', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      sm.transition('start_search');

      const result = sm.transition('cancel_by_rider');

      expect(result.ok).toBe(true);
      expect(result.value?.newState).toBe('cancelled_by_rider');
    });

    test('cannot transition to accepted directly', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      sm.transition('start_search');

      const result = sm.transition('accept_offer');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('full lifecycle', () => {
    test('completes full happy path', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');

      // Pending → Searching
      let result = sm.transition('start_search');
      expect(result.ok && result.value.newState).toBe('searching');

      // Searching → Offer Made
      result = sm.transition('make_offer', { offerId: 'offer-789' });
      expect(result.ok && result.value.newState).toBe('offer_made');

      // Offer Made → Accepted
      result = sm.transition('accept_offer', { driverId: 'driver-111' });
      expect(result.ok && result.value.newState).toBe('accepted');

      // Accepted → In Progress
      result = sm.transition('start_trip');
      expect(result.ok && result.value.newState).toBe('in_progress');

      // In Progress → Completed
      result = sm.transition('complete_trip');
      expect(result.ok && result.value.newState).toBe('completed');

      // Completed → Rated
      result = sm.transition('rate');
      expect(result.ok && result.value.newState).toBe('rated');
      expect(sm.isTerminal()).toBe(true);
    });
  });

  describe('terminal states', () => {
    test('rated state is terminal', () => {
      const sm = RequestStateMachine.restore({
        requestId: 'req-123',
        riderId: 'rider-456',
        currentState: 'rated',
      });

      expect(sm.isTerminal()).toBe(true);
      const result = sm.transition('start_trip');
      expect(result.ok).toBe(false);
    });

    test('cancelled state is terminal', () => {
      const sm = RequestStateMachine.restore({
        requestId: 'req-123',
        riderId: 'rider-456',
        currentState: 'cancelled_by_rider',
      });

      expect(sm.isTerminal()).toBe(true);
    });

    test('expired state is terminal', () => {
      const sm = RequestStateMachine.restore({
        requestId: 'req-123',
        riderId: 'rider-456',
        currentState: 'expired',
      });

      expect(sm.isTerminal()).toBe(true);
    });
  });

  describe('getAvailableTransitions', () => {
    test('pending has correct transitions', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      const transitions = sm.getAvailableTransitions();

      expect(transitions).toContain('start_search');
      expect(transitions).toContain('cancel_by_rider');
    });

    test('searching has correct transitions', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');
      sm.transition('start_search');

      const transitions = sm.getAvailableTransitions();

      expect(transitions).toContain('make_offer');
      expect(transitions).toContain('expire');
      expect(transitions).toContain('cancel_by_rider');
      expect(transitions).not.toContain('accept_offer');
    });
  });

  describe('canTransition', () => {
    test('returns true for valid transition', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');

      expect(sm.canTransition('start_search')).toBe(true);
      expect(sm.canTransition('cancel_by_rider')).toBe(true);
    });

    test('returns false for invalid transition', () => {
      const sm = RequestStateMachine.create('req-123', 'rider-456');

      expect(sm.canTransition('accept_offer')).toBe(false);
      expect(sm.canTransition('complete_trip')).toBe(false);
    });
  });
});

describe('validateTransition', () => {
  test('valid transition: pending → searching', () => {
    const result = validateTransition('pending', 'searching');
    expect(result.ok).toBe(true);
  });

  test('invalid transition: pending → completed', () => {
    const result = validateTransition('pending', 'completed');
    expect(result.ok).toBe(false);
  });

  test('valid transition: searching → offer_made', () => {
    const result = validateTransition('searching', 'offer_made');
    expect(result.ok).toBe(true);
  });

  test('valid transition: accepted → in_progress', () => {
    const result = validateTransition('accepted', 'in_progress');
    expect(result.ok).toBe(true);
  });

  test('valid transition: completed → rated', () => {
    const result = validateTransition('completed', 'rated');
    expect(result.ok).toBe(true);
  });
});

describe('getNextStates', () => {
  test('pending → searching, cancelled_by_rider', () => {
    const next = getNextStates('pending');
    expect(next).toContain('searching');
    expect(next).toContain('cancelled_by_rider');
  });

  test('searching → offer_made, expired, cancelled', () => {
    const next = getNextStates('searching');
    expect(next).toContain('offer_made');
    expect(next).toContain('expired');
    expect(next).toContain('cancelled_by_rider');
    expect(next).toContain('cancelled_no_driver');
  });

  test('accepted → in_progress, cancelled', () => {
    const next = getNextStates('accepted');
    expect(next).toContain('in_progress');
    expect(next).toContain('cancelled_by_rider');
    expect(next).toContain('cancelled_by_driver');
  });

  test('completed → rated', () => {
    const next = getNextStates('completed');
    expect(next).toContain('rated');
  });
});
