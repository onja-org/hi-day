/**
 * Types for beforePack.mjs, which stays JavaScript because electron-builder
 * executes the hook directly and cannot run TypeScript.
 */
export declare function requirementFor(
  platform: string,
): { path: string; alongside: string[]; build: string } | null;

export declare function missingArchitectures(lipoOutput: string): string[];

export declare function missingDataFiles(required: {
  path: string;
  alongside: string[];
}): string[];

export default function beforePack(context: {
  electronPlatformName: string;
}): void;
