/**
 * الغرض: تصدير supabase infrastructure
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

export { getSupabaseClient, getSupabaseAnonClient } from './client';
export type { SupabaseClient } from './client';
export { claimRide, recordAttendance, renewSubscription } from './rpc';
export type {
  ClaimRideInput,
  ClaimRideResult,
  RecordAttendanceInput,
  RecordAttendanceResult,
  RenewSubscriptionInput,
  RenewSubscriptionResult,
} from './rpc';

// User repository
export {
  createUser,
  getUserByTelegramId,
  getUserById,
  updateUserLanguage,
} from './user-repo';
export type { User } from './user-repo';

// Driver repository
export {
  createDriver,
  getDriverByUserId,
  getDriverById,
  findAvailableDrivers,
  isDriverActive,
} from './driver-repo';
export type { Driver, CreateDriverInput } from './driver-repo';

// Rider repository
export {
  createRider,
  getRiderByUserId,
  getRiderById,
} from './rider-repo';
export type { Rider, CreateRiderInput } from './rider-repo';

// Request repository
export {
  createRequest,
  getRequestById,
  getRequestsByRiderId,
  updateRequestStatus,
} from './request-repo';
export type { Request, CreateRequestInput } from './request-repo';

// City repository
export { getAllCities, getCityById, getCityDisplayName, CITY_IDS } from './city-repo';
export type { City } from './city-repo';
export type { CityId } from './city-repo';

// Offer repository
export {
  getOffersByRequestId,
  getPendingOffersByDriverId,
  expireOffer,
  expireAllPendingOffersForRequest,
} from './offer-repo';
export type { Offer } from './offer-repo';
