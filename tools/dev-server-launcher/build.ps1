$ErrorActionPreference = 'Stop'

$toolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $toolRoot '..\..'))
$buildRoot = Join-Path $projectRoot '.codex_tmp\launcher-build'
$outputName = (-join @([char]0xAC1C, [char]0xBC1C, [char]0xC11C, [char]0xBC84, [char]0x005F, [char]0xC2E4, [char]0xD589)) + '.exe'
$temporaryExe = Join-Path $buildRoot 'dev-server-launcher.exe'
$outputExe = Join-Path $projectRoot $outputName
$source = Join-Path $toolRoot 'Program.cs'

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
if (Test-Path -LiteralPath $temporaryExe) {
    Remove-Item -LiteralPath $temporaryExe -Force
}

Add-Type `
    -Path $source `
    -ReferencedAssemblies @('System.dll', 'System.Core.dll') `
    -OutputAssembly $temporaryExe `
    -OutputType WindowsApplication

Copy-Item -LiteralPath $temporaryExe -Destination $outputExe -Force
$item = Get-Item -LiteralPath $outputExe
$hash = (Get-FileHash -LiteralPath $outputExe -Algorithm SHA256).Hash
Write-Output ("EXE={0}" -f $item.FullName)
Write-Output ("BYTES={0}" -f $item.Length)
Write-Output ("SHA256={0}" -f $hash)
