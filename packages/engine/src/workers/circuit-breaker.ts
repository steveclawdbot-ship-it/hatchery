/**
 * Circuit breaker: auto-disable a worker after consecutive failures.
 * Default threshold: 3 failures.
 */
export class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailure: Date | null = null;
  private resetTimeoutMs: number;

  constructor(
    private threshold: number = 3,
    resetTimeoutMs: number = 5 * 60 * 1000,
  ) {
    this.resetTimeoutMs = resetTimeoutMs;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open' && this.lastFailure) {
      const elapsed = Date.now() - this.lastFailure.getTime();
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
    }

    if (this.state === 'half-open') return true;

    return false;
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  getState(): { state: string; failures: number; threshold: number } {
    return { state: this.state, failures: this.failures, threshold: this.threshold };
  }
}
