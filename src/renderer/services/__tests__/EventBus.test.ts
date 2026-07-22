import { describe, it, expect, beforeEach } from 'vitest';

/**
 * EventBus - Tests
 */
import { EventBus } from '../../services/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on/emit', () => {
    it('should call listener when event is emitted', () => {
      let received: string | undefined;
      eventBus.on('test', (data) => {
        received = data as string;
      });
      eventBus.emit('test', 'hello');
      expect(received).toBe('hello');
    });

    it('should support multiple listeners', () => {
      const calls: string[] = [];
      eventBus.on('test', () => calls.push('a'));
      eventBus.on('test', () => calls.push('b'));
      eventBus.emit('test');
      expect(calls).toEqual(['a', 'b']);
    });

    it('should not call listener for different events', () => {
      let called = false;
      eventBus.on('test', () => {
        called = true;
      });
      eventBus.emit('other');
      expect(called).toBe(false);
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      let count = 0;
      eventBus.once('test', () => {
        count++;
      });
      eventBus.emit('test');
      eventBus.emit('test');
      eventBus.emit('test');
      expect(count).toBe(1);
    });
  });

  describe('off', () => {
    it('should remove listener', () => {
      let count = 0;
      const listener = () => {
        count++;
      };
      eventBus.on('test', listener);
      eventBus.emit('test');
      eventBus.off('test', listener);
      eventBus.emit('test');
      expect(count).toBe(1);
    });

    it('should return unsubscribe function', () => {
      let count = 0;
      const unsubscribe = eventBus.on('test', () => {
        count++;
      });
      eventBus.emit('test');
      unsubscribe();
      eventBus.emit('test');
      expect(count).toBe(1);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for an event', () => {
      let count = 0;
      eventBus.on('test', () => count++);
      eventBus.on('test', () => count++);
      eventBus.removeAllListeners('test');
      eventBus.emit('test');
      expect(count).toBe(0);
    });

    it('should remove all listeners when no event specified', () => {
      let count = 0;
      eventBus.on('test1', () => count++);
      eventBus.on('test2', () => count++);
      eventBus.removeAllListeners();
      eventBus.emit('test1');
      eventBus.emit('test2');
      expect(count).toBe(0);
    });
  });

  describe('listenerCount', () => {
    it('should return correct count', () => {
      eventBus.on('test', () => {});
      eventBus.on('test', () => {});
      expect(eventBus.listenerCount('test')).toBe(2);
    });

    it('should return 0 for unknown event', () => {
      expect(eventBus.listenerCount('unknown')).toBe(0);
    });
  });

  describe('eventNames', () => {
    it('should return registered event names', () => {
      eventBus.on('test1', () => {});
      eventBus.on('test2', () => {});
      expect(eventBus.eventNames()).toContain('test1');
      expect(eventBus.eventNames()).toContain('test2');
    });
  });

  describe('error handling', () => {
    it('should not throw if listener throws', () => {
      eventBus.on('test', () => {
        throw new Error('test error');
      });
      expect(() => eventBus.emit('test')).not.toThrow();
    });

    it('should call other listeners even if one throws', () => {
      let called = false;
      eventBus.on('test', () => {
        throw new Error('test error');
      });
      eventBus.on('test', () => {
        called = true;
      });
      eventBus.emit('test');
      expect(called).toBe(true);
    });
  });
});
