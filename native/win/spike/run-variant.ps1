# Runs one spike variant end-to-end: JIT build sanity check, NativeAOT
# publish attempt, and — the actual point of this spike — running the
# published binary for real and recording whether its UIA read succeeded.
#
# NEVER RUN OR VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine,
# no PowerShell available locally either. Written as simply as possible to
# minimize syntax risk; if this errors out in CI, that's expected — fix
# from the real error message.
#
# A variant whose AOT publish fails to COMPILE is not treated as a CI
# failure (exit 0 either way) — that is itself a valid, informative spike
# result, not a broken pipeline.

param(
    [Parameter(Mandatory = $true)][string]$VariantPath,
    [Parameter(Mandatory = $true)][string]$VariantName
)

$outDir = "spike-results"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$projectDir = Split-Path $VariantPath -Parent

$result = [ordered]@{
    variant = $VariantName
    jitBuildSucceeded = $false
    aotPublishSucceeded = $false
    aotPublishError = $null
    aotBinarySizeBytes = $null
    uiaReadSucceededUnderAot = $null
    uiaReadError = $null
    uiaReadRawOutput = $null
    fallbackSelfContainedPublishSucceeded = $false
    fallbackSelfContainedBinarySizeBytes = $null
    uiaReadSucceededUnderFallbackSelfContained = $null
    uiaReadErrorUnderFallbackSelfContained = $null
    coldStartMsIndicativeOnly = $null
    hundredReadTimeMsIndicativeOnly = $null
    coldStartMsIndicativeOnlyFallbackSelfContained = $null
}

function Write-Result {
    $result | ConvertTo-Json | Set-Content "$outDir/$VariantName.json"
    Write-Host "=== $VariantName ==="
    Get-Content "$outDir/$VariantName.json"
}

# 1. Plain JIT build — fast sanity check before attempting AOT.
$buildOutput = dotnet build $VariantPath -c Release 2>&1
if ($LASTEXITCODE -ne 0) {
    $result.jitBuildSucceeded = $false
    $result.aotPublishError = "JIT build itself failed:`n" + ($buildOutput -join "`n")
    Write-Result
    exit 0
}
$result.jitBuildSucceeded = $true

# 2. Attempt NativeAOT publish — the real question this spike is asking.
$aotOutDir = Join-Path $projectDir "publish-aot"
$aotOutput = dotnet publish $VariantPath -c Release -r win-x64 --self-contained -p:PublishAot=true -o $aotOutDir 2>&1

if ($LASTEXITCODE -eq 0) {
    $result.aotPublishSucceeded = $true
    $exeFile = Get-ChildItem $aotOutDir -Filter "*.exe" | Select-Object -First 1
    $exePath = $exeFile.FullName
    $result.aotBinarySizeBytes = $exeFile.Length

    # 3. Run the published binary for real — does the UIA read actually
    #    work, or did AOT trim away dynamic COM marshalling it needed?
    $runOutput = & $exePath 2>&1
    $result.uiaReadRawOutput = ($runOutput -join "`n")
    $jsonLine = $runOutput | Where-Object { $_ -like "{*}" } | Select-Object -Last 1

    if ($jsonLine) {
        try {
            $parsed = $jsonLine | ConvertFrom-Json
            $result.uiaReadSucceededUnderAot = $parsed.UiaReadSucceeded
            if (-not $parsed.UiaReadSucceeded) {
                $result.uiaReadError = $parsed.Error
            }
        }
        catch {
            $result.uiaReadSucceededUnderAot = $false
            $result.uiaReadError = "Could not parse JSON output line: $jsonLine"
        }
    }
    else {
        $result.uiaReadSucceededUnderAot = $false
        $result.uiaReadError = "No JSON line found in program output."
    }

    # 4. Indicative-only timing — never used to decide the recommendation.
    #    Only meaningful when the read itself actually worked; a crashing
    #    binary can "cold start" fast too, so don't let that be mistaken
    #    for a working measurement.
    if ($result.uiaReadSucceededUnderAot) {
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            & $exePath | Out-Null
            $sw.Stop()
            $result.coldStartMsIndicativeOnly = $sw.ElapsedMilliseconds

            $sw100 = [System.Diagnostics.Stopwatch]::StartNew()
            for ($i = 0; $i -lt 100; $i++) {
                & $exePath | Out-Null
            }
            $sw100.Stop()
            $result.hundredReadTimeMsIndicativeOnly = $sw100.ElapsedMilliseconds
        }
        catch {
            # Timing is optional — never let a failure here affect the result above.
        }
    }
}
else {
    $result.aotPublishSucceeded = $false
    $result.aotPublishError = ($aotOutput -join "`n")
}

# Fallback per the brief: whenever AOT doesn't actually deliver a working
# UIA read — whether because the publish step itself failed to compile/link,
# or (as real CI runs showed) because publish succeeds but the binary
# throws InvalidProgramException at runtime — record a plain self-contained
# publish instead of guessing.
#
# Deliberately NOT PublishTrimmed=true: a real CI run showed trimming, on
# its own, disables built-in/classic COM interop via a documented .NET
# feature switch (see https://aka.ms/dotnet-illink/com) — the exact same
# root cause as the AOT failure, just surfaced as a NotSupportedException
# instead of InvalidProgramException. So a trimmed build was never a viable
# fallback here regardless of AOT; only a non-trimmed self-contained publish
# can actually use classic COM interop. PublishSingleFile=true is kept —
# it does NOT imply trimming on its own, and without it this produces a
# directory of many DLLs plus the exe, understating the real deployable
# size. PublishAot=false explicitly overrides the csproj's
# <PublishAot>true</PublishAot> — without it this would just retry AOT.
if (-not $result.uiaReadSucceededUnderAot) {
    $fallbackOutDir = Join-Path $projectDir "publish-self-contained"
    dotnet publish $VariantPath -c Release -r win-x64 --self-contained -p:PublishAot=false -p:PublishTrimmed=false -p:PublishSingleFile=true -o $fallbackOutDir 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $result.fallbackSelfContainedPublishSucceeded = $true
        $fallbackExe = Get-ChildItem $fallbackOutDir -Filter "*.exe" | Select-Object -First 1
        $result.fallbackSelfContainedBinarySizeBytes = $fallbackExe.Length

        # The self-contained fallback is the candidate we'd actually ship
        # if AOT is off the table — so this is the one build whose real
        # read result and timing matter for the recommendation.
        $fallbackRunOutput = & $fallbackExe.FullName 2>&1
        $fallbackJsonLine = $fallbackRunOutput | Where-Object { $_ -like "{*}" } | Select-Object -Last 1
        if ($fallbackJsonLine) {
            try {
                $fallbackParsed = $fallbackJsonLine | ConvertFrom-Json
                $result.uiaReadSucceededUnderFallbackSelfContained = $fallbackParsed.UiaReadSucceeded
                if (-not $fallbackParsed.UiaReadSucceeded) {
                    $result.uiaReadErrorUnderFallbackSelfContained = $fallbackParsed.Error
                }
            }
            catch {
                $result.uiaReadSucceededUnderFallbackSelfContained = $false
                $result.uiaReadErrorUnderFallbackSelfContained = "Could not parse JSON output line: $fallbackJsonLine"
            }
        }
        else {
            $result.uiaReadSucceededUnderFallbackSelfContained = $false
            $result.uiaReadErrorUnderFallbackSelfContained = "No JSON line found in fallback program output."
        }

        if ($result.uiaReadSucceededUnderFallbackSelfContained) {
            try {
                $swFallback = [System.Diagnostics.Stopwatch]::StartNew()
                & $fallbackExe.FullName | Out-Null
                $swFallback.Stop()
                $result.coldStartMsIndicativeOnlyFallbackSelfContained = $swFallback.ElapsedMilliseconds
            }
            catch {
                # Timing is optional — never let a failure here affect the result above.
            }
        }
    }
}

Write-Result
exit 0
