/**
 * `x11` ships no types. Declared locally rather than via @types/x11, which
 * describes an older API — and only these calls are used.
 *
 * Request callbacks return `unknown` on purpose: the library reads the
 * return value, and only `true` stops it re-emitting an error as `'error'`
 * on the client (see x11-window-tracker.ts's `HANDLED`).
 */
declare module 'x11' {
  export interface X11Client {
    InternAtom(
      onlyIfExists: boolean,
      name: string,
      cb: (err: Error | null, atom: number) => unknown,
    ): void;
    GetProperty(
      del: number,
      window: number,
      property: number,
      type: number,
      offset: number,
      length: number,
      cb: (err: Error | null, prop?: { data?: Buffer }) => unknown,
    ): void;
    /** X protocol errors no callback took, and connection failures. */
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export interface X11Display {
    client: X11Client;
    screen: { root: number }[];
    terminate?: () => void;
  }

  export function createClient(
    cb: (err: Error | null, display?: X11Display) => void,
  ): void;

  const x11: { createClient: typeof createClient };
  export default x11;
}
