/**
 * Calendar Sync Module
 * 
 * This module provides integration with external calendar services
 * for syncing financial events like bill due dates, milestones, and payoff dates.
 * 
 * Supported Providers:
 * - Google Calendar (fully implemented)
 * - TickTick (coming soon)
 */

// Google Calendar
export * from './google-calendar';

// TickTick (placeholder)
export * from './ticktick-calendar';

// Event Generation (excluding CalendarEvent which is already exported from google-calendar)
export {
  generateAllEvents,
  getSyncSettings,
  type GeneratedEvent,
  type EventSource,
  type SyncSettings,
} from './event-generator';

// Sync Service
export * from './sync-service';
