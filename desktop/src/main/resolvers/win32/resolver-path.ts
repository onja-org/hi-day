import { join } from 'node:path';

/**
 * Resolves the path to the win-resolver.exe side-car binary — mirrors
 * resolvers/darwin/firefox-ax.ts's DEFAULT_BINARY_PATH pattern exactly.
 *
 * Correct for dev (electron .) and a plain `pnpm build` output after
 * `dotnet build -c Release` (see native/win/resolver/MANUAL_TESTING.md),
 * since both put dist/main (or src/main) at the same depth relative to
 * native/win/resolver, and `bin/<Configuration>/<TargetFramework>/
 * <RuntimeIdentifier>/<AssemblyName>.exe` is the standard MSBuild output
 * layout for this project's csproj settings. NOT correct inside a
 * packaged app — there, the published win-resolver.exe is under
 * process.resourcesPath (electron-builder's extraResources), not
 * reachable by walking up from __dirname inside the asar archive. Wired
 * into main.ts's resolverSpawnConfigForPlatform, which passes
 * isPackaged/resourcesPath explicitly from Electron's `app`.
 */
const DEV_RESOLVER_PATH = join(
  __dirname,
  '../../../../native/win/resolver/WinResolver/bin/Release/net8.0-windows/win-x64/win-resolver.exe',
);

export interface ResolveWinResolverPathOptions {
  isPackaged: boolean;
  resourcesPath: string;
}

export function resolveWinResolverPath(options: ResolveWinResolverPathOptions): string {
  if (options.isPackaged) {
    return join(options.resourcesPath, 'native', 'win', 'resolver', 'win-resolver.exe');
  }
  return DEV_RESOLVER_PATH;
}
