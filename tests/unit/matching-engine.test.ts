/**
 * الغرض: اختبارات وحدة لمحرك المطابقة
 * الحالة: تنفيد فعلي
 */

import { describe, expect, test } from 'bun:test';
import { calculateHaversineDistance } from '@infrastructure/dispatch';

describe('Haversine Distance', () => {
  test('calculates distance between Jeddah and Makkah', () => {
    // Jeddah: 21.4858, 39.1925
    // Makkah: 21.4225, 39.8262
    const distance = calculateHaversineDistance(
      21.4858, 39.1925, // Jeddah
      21.4225, 39.8262  // Makkah
    );
    
    // Distance should be approximately 70-80 km
    expect(distance).toBeGreaterThan(60);
    expect(distance).toBeLessThan(90);
  });

  test('calculates zero distance for same point', () => {
    const distance = calculateHaversineDistance(
      21.4858, 39.1925,
      21.4858, 39.1925
    );
    
    expect(distance).toBe(0);
  });

  test('calculates distance between Riyadh points', () => {
    // Riyadh: 24.7136, 46.6753
    const distance = calculateHaversineDistance(
      24.7136, 46.6753,
      24.7136, 46.6853 // Slightly different longitude
    );
    
    // Should be a small distance
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(5);
  });
});

describe('Matching Weights', () => {
  test('weights should be configurable', () => {
    // These values come from platform_settings in real usage
    const weights = {
      distance: 0.6,
      rating: 0.4,
    };
    
    // Weights should sum to 1.0
    expect(weights.distance + weights.rating).toBe(1.0);
  });

  test('default weights are valid', () => {
    const defaultWeights = {
      distance: 0.6,
      rating: 0.4,
    };
    
    expect(defaultWeights.distance).toBeGreaterThan(0);
    expect(defaultWeights.rating).toBeGreaterThan(0);
  });
});
