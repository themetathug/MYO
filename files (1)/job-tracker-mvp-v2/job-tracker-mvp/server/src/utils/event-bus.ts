import { EventEmitter } from 'events';

/**
 * Application-wide event bus.
 * Used to decouple route handlers from the SSE layer in index.ts,
 * eliminating the circular require('../index') pattern.
 *
 * Usage:
 *   import { appEvents } from '../utils/event-bus';
 *   appEvents.emit('user:refresh', userId);
 *
 * Listener (index.ts):
 *   appEvents.on('user:refresh', (userId) => notifyUser(userId, 'refresh'));
 */
class AppEventBus extends EventEmitter {}

export const appEvents = new AppEventBus();
appEvents.setMaxListeners(100);
