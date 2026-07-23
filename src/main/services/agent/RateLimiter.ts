/**
 * Rate Limiter - Token bucket implementation for API request throttling.
 */
import { logger } from '../../utils/logger';

const log = logger.scope('RateLimiter');

interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  /**
   * Check if a request is allowed under rate limits.
   * @param key - Rate limit key (e.g., provider ID)
   * @param tokens - Number of tokens to consume
   * @param maxTokens - Max tokens in bucket
   * @param refillMs - Time to fully refill the bucket
   * @returns true if allowed, false if rate limited
   */
  check(key: string, tokens: number = 1, maxTokens: number = 60, refillMs: number = 60000): boolean {
    let bucket = this.buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = {
        tokens: maxTokens,
        maxTokens,
        refillRate: maxTokens / refillMs,
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Wait until a request can be made.
   */
  async waitForToken(key: string, tokens: number = 1, maxTokens: number = 60, refillMs: number = 60000): Promise<void> {
    let waitMs = 0;
    while (!this.check(key, tokens, maxTokens, refillMs)) {
      waitMs = 100;
      log.debug(`Rate limited on ${key}, waiting ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      // Increase wait for next attempt (exponential backoff up to 2s)
      waitMs = Math.min(waitMs * 1.5, 2000);
    }
  }

  /**
   * Get remaining tokens for a key.
   */
  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return 0;
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    return Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
  }

  /**
   * Reset a rate limit bucket.
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all buckets.
   */
  resetAll(): void {
    this.buckets.clear();
  }
}
