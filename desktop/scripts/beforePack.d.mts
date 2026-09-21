/**
 * Types for beforePack.mjs, which stays JavaScript because electron-builder
 * executes the hook directly and cannot run TypeScript.
 */
export declare function requirementFor(
  platform: string,
): { path: string; build: string } | null;

export declare function missingArchitectures(lipoOutput: string): string[];

export default function beforePack(context: {
  electronPlatformName: string;
}): void;
