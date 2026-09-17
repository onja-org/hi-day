# Signs the published win-resolver.exe side-car binary — separate from
# (and in addition to) whatever signs the final packaged installer/app
# .exe. An unsigned child .exe sitting beside a signed app is exactly what
# EDR products flag (Prompt C.3), so this must run as part of packaging,
# not be treated as optional.
#
# NEVER RUN OR VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine,
# no code-signing certificate available in this environment. Written from
# signtool's documented usage; fix from the real error once this runs
# somewhere with an actual certificate.
#
# The certificate reference is read from an env var, never committed or
# hardcoded — mirrors electron-builder's own CSC_LINK/CSC_KEY_PASSWORD
# convention for the main app's signing. Which env var(s) are actually
# set depends on what kind of certificate this project ends up using
# (a .pfx file + password, vs. a cert already installed in the machine's
# certificate store referenced by thumbprint) — both forms are supported
# below since neither has been decided yet; skip signing entirely (with a
# clear warning, not a silent no-op) if neither is configured, so a local
#/ CI build without signing set up still produces a runnable binary
# rather than failing outright.

param(
    [Parameter(Mandatory = $true)][string]$ExePath
)

$certFile = $env:WIN_CODESIGN_PFX_PATH
$certPassword = $env:WIN_CODESIGN_PFX_PASSWORD
$certThumbprint = $env:WIN_CODESIGN_THUMBPRINT
$timestampUrl = "http://timestamp.digicert.com"

if (-not $certFile -and -not $certThumbprint) {
    Write-Warning "No signing certificate configured (WIN_CODESIGN_PFX_PATH or WIN_CODESIGN_THUMBPRINT) — leaving $ExePath unsigned. Do not ship this build."
    exit 0
}

if ($certFile) {
    if (-not $certPassword) {
        Write-Error "WIN_CODESIGN_PFX_PATH is set but WIN_CODESIGN_PFX_PASSWORD is not."
        exit 1
    }
    & signtool sign /f $certFile /p $certPassword /fd sha256 /tr $timestampUrl /td sha256 $ExePath
}
else {
    & signtool sign /sha1 $certThumbprint /fd sha256 /tr $timestampUrl /td sha256 $ExePath
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "signtool sign failed for $ExePath (exit $LASTEXITCODE)."
    exit $LASTEXITCODE
}

& signtool verify /pa $ExePath
exit $LASTEXITCODE
