import { DailyRating } from '@/types';
import { BackendReflection, ReflectionPayload } from '@/lib/api';

// In the UI a rating of 0 means "not set"; the API stores that as null.
const fromRating = (value: number | null) => value ?? 0;
const toRating = (value: number) => (value >= 1 && value <= 5 ? value : null);

export function mapBackendReflectionToRating(reflection: BackendReflection): DailyRating {
  return {
    date: reflection.date,
    performance: fromRating(reflection.performance),
    energy: fromRating(reflection.energy),
    mood: fromRating(reflection.mood),
    notes: reflection.notes ?? '',
  };
}

export function mapRatingToReflectionPayload(rating: Omit<DailyRating, 'date'>): ReflectionPayload {
  return {
    performance: toRating(rating.performance),
    energy: toRating(rating.energy),
    mood: toRating(rating.mood),
    notes: rating.notes?.trim() || null,
  };
}
