/**
 * الغرض: State Machine لإدارة دورة حياة الطلب
 * الحالة: تنفيد فعلي
 * ينتمي إلى: packages/application/dispatch/state-machine
 * 
 * دورة الحياة:
 * 
 *   [pending] ─── rider creates ───▶ [searching]
 *                                           │
 *                         ┌─────────────────┼─────────────────┐
 *                         │                 │                 │
 *                         ▼                 ▼                 ▼
 *                    [offer_made]      [expired]         [cancelled_by_rider]
 *                         │
 *                         ▼ driver accepts
 *                    [accepted]
 *                         │
 *                         ▼
 *                   [in_progress]
 *                         │
 *                         ▼
 *                   [completed]
 *                         │
 *                         ▼
 *                   [rated]
 *                         
 *   [accepted] ──▶ [cancelled_by_rider] (if driver takes too long)
 *   [searching] ──▶ [cancelled_by_rider] (rider cancels)
 */

import { Result, Err, Ok } from '@shared/result';

// Use extended status type for state machine
// (kernel's RequestStatus is simplified for DB storage)
export type ExtendedRequestStatus =
  | 'pending'
  | 'searching'
  | 'offer_made'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'rated'
  | 'expired'
  | 'cancelled_by_rider'
  | 'cancelled_by_driver'
  | 'cancelled_no_driver';

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

export type RequestState =
  | 'pending'
  | 'searching'
  | 'offer_made'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'rated'
  | 'expired'
  | 'cancelled_by_rider'
  | 'cancelled_by_driver'
  | 'cancelled_no_driver';

export type StateTransition =
  | 'create'
  | 'start_search'
  | 'make_offer'
  | 'accept_offer'
  | 'start_trip'
  | 'complete_trip'
  | 'rate'
  | 'expire'
  | 'cancel_by_rider'
  | 'cancel_by_driver'
  | 'cancel_no_driver'
  | 'driver_timeout';

export interface TransitionResult {
  success: boolean;
  newState: RequestState;
  error?: string;
}

export interface StateContext {
  requestId: string;
  currentState: RequestState;
  driverId?: string;
  riderId?: string;
  offerId?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ══════════════════════════════════════════════════════════════════
// VALID TRANSITIONS MAP
// ══════════════════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<RequestState, Partial<Record<StateTransition, RequestState>>> = {
  pending: {
    start_search: 'searching',
    cancel_by_rider: 'cancelled_by_rider',
  },

  searching: {
    make_offer: 'offer_made',
    expire: 'expired',
    cancel_by_rider: 'cancelled_by_rider',
    cancel_no_driver: 'cancelled_no_driver',
  },

  offer_made: {
    accept_offer: 'accepted',
    expire: 'expired',
    cancel_by_rider: 'cancelled_by_rider',
    cancel_no_driver: 'cancelled_no_driver',
    driver_timeout: 'expired',
  },

  accepted: {
    start_trip: 'in_progress',
    cancel_by_driver: 'cancelled_by_driver',
    cancel_by_rider: 'cancelled_by_rider',
  },

  in_progress: {
    complete_trip: 'completed',
    cancel_by_driver: 'cancelled_by_driver',
    cancel_by_rider: 'cancelled_by_rider',
  },

  completed: {
    rate: 'rated',
  },

  rated: {}, // Terminal state

  expired: {}, // Terminal state

  cancelled_by_rider: {}, // Terminal state

  cancelled_by_driver: {}, // Terminal state

  cancelled_no_driver: {}, // Terminal state
};

// ══════════════════════════════════════════════════════════════════
// STATE MACHINE CLASS
// ══════════════════════════════════════════════════════════════════

export class RequestStateMachine {
  private state: RequestState;
  private context: StateContext;

  constructor(context: StateContext) {
    this.state = context.currentState;
    this.context = context;
  }

  /**
   * Get current state
   */
  getState(): RequestState {
    return this.state;
  }

  /**
   * Get full context
   */
  getContext(): StateContext {
    return { ...this.context };
  }

  /**
   * Check if a transition is valid
   */
  canTransition(transition: StateTransition): boolean {
    const nextState = VALID_TRANSITIONS[this.state]?.[transition];
    return nextState !== undefined;
  }

  /**
   * Get available transitions from current state
   */
  getAvailableTransitions(): StateTransition[] {
    const transitions = VALID_TRANSITIONS[this.state];
    return Object.keys(transitions) as StateTransition[];
  }

  /**
   * Check if state is terminal
   */
  isTerminal(): boolean {
    return Object.keys(VALID_TRANSITIONS[this.state]).length === 0;
  }

  /**
   * Execute a transition
   */
  transition(
    action: StateTransition,
    metadata?: Partial<StateContext>
  ): Result<TransitionResult, string> {
    // Check if current state is terminal
    if (this.isTerminal()) {
      return Err(
        `Cannot transition from terminal state '${this.state}'`
      );
    }

    // Check if transition is valid
    const nextState = VALID_TRANSITIONS[this.state]?.[action];
    if (nextState === undefined) {
      return Err(
        `Invalid transition '${action}' from state '${this.state}'. ` +
        `Available: ${this.getAvailableTransitions().join(', ') || 'none'}`
      );
    }

    // Update context
    this.context = {
      ...this.context,
      currentState: nextState,
      ...metadata,
    };

    // Update state
    this.state = nextState;

    return Ok({
      success: true,
      newState: nextState,
    });
  }

  /**
   * Create a new request
   */
  static create(requestId: string, riderId: string): RequestStateMachine {
    return new RequestStateMachine({
      requestId,
      riderId,
      currentState: 'pending',
    });
  }

  /**
   * Restore from database
   */
  static restore(context: StateContext): RequestStateMachine {
    return new RequestStateMachine(context);
  }
}

// ══════════════════════════════════════════════════════════════════
// CONVENIENCE METHODS
// ══════════════════════════════════════════════════════════════════

export function validateTransition(
  currentStatus: ExtendedRequestStatus,
  targetStatus: ExtendedRequestStatus
): Result<void, string> {
  const validNextStates = VALID_TRANSITIONS[currentStatus] ?? {};
  const canTransition = Object.values(validNextStates).includes(targetStatus);

  if (!canTransition) {
    return Err(
      `Cannot transition from '${currentStatus}' to '${targetStatus}'`
    );
  }

  return Ok(undefined);
}

export function getNextStates(currentStatus: ExtendedRequestStatus): ExtendedRequestStatus[] {
  const nextStates = VALID_TRANSITIONS[currentStatus] ?? {};
  return Object.values(nextStates) as ExtendedRequestStatus[];
}
