param(
  [string]$RawDir = "",
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RawDir)) {
  $RawDir = Join-Path $repoRoot ".codex_tmp\suno-audio-v033\raw"
}
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $repoRoot "public\assets\audio"
}

$culture = [System.Globalization.CultureInfo]::InvariantCulture
$bgmDir = Join-Path $OutputDir "bgm"
$sfxDir = Join-Path $OutputDir "sfx"
$qcPath = Join-Path $repoRoot ".codex_tmp\suno-audio-v033\audio-qc.generated.json"
New-Item -ItemType Directory -Path $bgmDir -Force | Out-Null
New-Item -ItemType Directory -Path $sfxDir -Force | Out-Null

$bgm = @(
  @{ id = "early"; raw = "dawn-formation-loop.raw.mp3"; output = "dawn-formation-loop.mp3" },
  @{ id = "mid"; raw = "five-elements-march-loop.raw.mp3"; output = "five-elements-march-loop.mp3" },
  @{ id = "late"; raw = "inkstorm-siege-loop.raw.mp3"; output = "inkstorm-siege-loop.mp3" },
  @{ id = "boss"; raw = "seal-guardian-boss-loop.raw.mp3"; output = "seal-guardian-boss-loop.mp3" },
  @{ id = "final"; raw = "heavenly-seal-final-loop.raw.mp3"; output = "heavenly-seal-final-loop.mp3" }
)

$sfx = @(
  @{ id = "ui-confirm"; raw = "ui-confirm.raw.mp3"; output = "ui-confirm.mp3" },
  @{ id = "summon"; raw = "jaryeong-summon.raw.mp3"; output = "jaryeong-summon.mp3" },
  @{ id = "fusion-strategy"; raw = "strategy-fusion.raw.mp3"; output = "strategy-fusion.mp3" },
  @{ id = "fusion-casual"; raw = "casual-fusion.raw.mp3"; output = "casual-fusion.mp3" },
  @{ id = "concentration"; raw = "concentration.raw.mp3"; output = "concentration.mp3" },
  @{ id = "upgrade"; raw = "tower-upgrade.raw.mp3"; output = "tower-upgrade.mp3" },
  @{ id = "dismantle"; raw = "spirit-dismantle.raw.mp3"; output = "spirit-dismantle.mp3" },
  @{ id = "goal-complete"; raw = "goal-complete.raw.mp3"; output = "goal-complete.mp3" },
  @{ id = "wave-start"; raw = "wave-start.raw.mp3"; output = "wave-start.mp3" },
  @{ id = "boss-warning"; raw = "boss-warning.raw.mp3"; output = "boss-warning.mp3" },
  @{ id = "victory"; raw = "victory.raw.mp3"; output = "victory.mp3" },
  @{ id = "defeat"; raw = "defeat.raw.mp3"; output = "defeat.mp3" }
)

function Invoke-Captured([string]$Command, [string[]]$Arguments) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $Command @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw "$Command failed with exit code $exitCode`n$output"
  }
  return $output
}

function Get-LoudnormMeasurement([string]$Path) {
  $text = Invoke-Captured "ffmpeg" @(
    "-hide_banner", "-nostats", "-i", $Path,
    "-af", "loudnorm=I=-20:TP=-1.5:LRA=11:print_format=json",
    "-f", "null", "NUL"
  )
  $match = [regex]::Match($text, '(?s)\{\s*"input_i".*?\}')
  if (-not $match.Success) {
    throw "Could not parse loudnorm measurement for $Path"
  }
  return $match.Value | ConvertFrom-Json
}

function Get-MaxVolume([string]$Path) {
  $text = Invoke-Captured "ffmpeg" @(
    "-hide_banner", "-nostats", "-i", $Path,
    "-af", "volumedetect", "-f", "null", "NUL"
  )
  $match = [regex]::Match($text, 'max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB')
  if (-not $match.Success) {
    throw "Could not parse max_volume for $Path"
  }
  return [double]::Parse($match.Groups[1].Value, $culture)
}

function Get-Duration([string]$Path) {
  $text = Invoke-Captured "ffprobe" @(
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", $Path
  )
  return [Math]::Round([double]::Parse($text.Trim(), $culture), 3)
}

$qc = @()

foreach ($asset in $bgm) {
  $inputPath = Join-Path $RawDir $asset.raw
  $outputPath = Join-Path $bgmDir $asset.output
  if (-not (Test-Path -LiteralPath $inputPath)) {
    throw "Missing raw BGM: $inputPath"
  }

  $first = Get-LoudnormMeasurement $inputPath
  $filter = "loudnorm=I=-20:TP=-1.5:LRA=11:measured_I=$($first.input_i):measured_LRA=$($first.input_lra):measured_TP=$($first.input_tp):measured_thresh=$($first.input_thresh):offset=$($first.target_offset):linear=true:print_format=summary"
  Invoke-Captured "ffmpeg" @(
    "-y", "-hide_banner", "-nostats", "-i", $inputPath,
    "-map_metadata", "-1", "-af", $filter,
    "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "192k", $outputPath
  ) | Out-Null

  $measured = Get-LoudnormMeasurement $outputPath
  $qc += [ordered]@{
    id = $asset.id
    kind = "bgm"
    file = "assets/audio/bgm/$($asset.output)"
    durationSeconds = Get-Duration $outputPath
    integratedLufs = [double]::Parse($measured.input_i, $culture)
    truePeakDbtp = [double]::Parse($measured.input_tp, $culture)
    loudnessRangeLu = [double]::Parse($measured.input_lra, $culture)
  }
}

foreach ($asset in $sfx) {
  $inputPath = Join-Path $RawDir $asset.raw
  $outputPath = Join-Path $sfxDir $asset.output
  if (-not (Test-Path -LiteralPath $inputPath)) {
    throw "Missing raw SFX: $inputPath"
  }

  $sourcePeak = Get-MaxVolume $inputPath
  $baseGain = -1.0 - $sourcePeak
  $bestGain = $baseGain
  $bestScore = [double]::PositiveInfinity
  foreach ($offset in @(-0.8, -0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6, 0.8)) {
    $gain = $baseGain + $offset
    $gainText = $gain.ToString("0.###", $culture)
    Invoke-Captured "ffmpeg" @(
      "-y", "-hide_banner", "-nostats", "-i", $inputPath,
      "-map_metadata", "-1", "-af", "volume=${gainText}dB",
      "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "192k", $outputPath
    ) | Out-Null
    $candidatePeak = Get-MaxVolume $outputPath
    $candidateScore = [Math]::Abs(-1.0 - $candidatePeak)
    if ($candidatePeak -gt -0.7) {
      $candidateScore += 10.0
    }
    if ($candidateScore -lt $bestScore) {
      $bestGain = $gain
      $bestScore = $candidateScore
    }
  }

  $bestGainText = $bestGain.ToString("0.###", $culture)
  Invoke-Captured "ffmpeg" @(
    "-y", "-hide_banner", "-nostats", "-i", $inputPath,
    "-map_metadata", "-1", "-af", "volume=${bestGainText}dB",
    "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "192k", $outputPath
  ) | Out-Null
  $outputPeak = Get-MaxVolume $outputPath

  $qc += [ordered]@{
    id = $asset.id
    kind = "sfx"
    file = "assets/audio/sfx/$($asset.output)"
    durationSeconds = Get-Duration $outputPath
    maxPeakDbfs = $outputPeak
  }
}

$report = [ordered]@{
  generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
  targets = [ordered]@{
    bgm = "loudnorm I=-20:TP=-1.5:LRA=11"
    sfx = "peak -1 dBFS"
  }
  assets = $qc
}

$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $qcPath -Encoding utf8
Write-Output "Normalized $($bgm.Count) BGM and $($sfx.Count) SFX."
Write-Output "QC report: $qcPath"
