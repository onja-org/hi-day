/**
 * A minimal strictly-typed event emitter. Node's own EventEmitter types
 * `on`/`emit` with `...args: any[]`, which the session/url-capture code
 * deliberately avoids (`any` is disallowed here, unlike backend).
 */
export class TypedEmitter<Events extends Record<string, unknown>> {
  private readonly listeners: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    const set = this.listeners[event] ?? new Set();
    set.add(handler);
    this.listeners[event] = set;
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    this.listeners[event]?.delete(handler);
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const handler of this.listeners[event] ?? []) {
      handler(payload);
    }
  }
}
