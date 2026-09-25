/**
 * `x11` ships no types. Declared locally rather than via @types/x11, which
 * describes an older API — and only these three calls are used.
 */
declare module 'x11' {
  export interface X11Client {
    InternAtom(
      onlyIfExists: boolean,
      name: string,
      cb: (err: Error | null, atom: number) => void,
    ): void;
    GetProperty(
      del: number,
      window: number,
      property: number,
      type: number,
      offset: number,
      length: number,
      cb: (err: Error | null, prop?: { data?: Buffer }) => void,
    ): void;
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
