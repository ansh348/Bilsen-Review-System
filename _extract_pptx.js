async function main() {
  const { execFileSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");

  const pptxPath = join(process.cwd(), "slides319.pptx");
  if (!existsSync(pptxPath)) {
    throw new Error(`slides319.pptx not found at ${pptxPath}`);
  }

  const script = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = ${JSON.stringify(pptxPath)}
$dst = Join-Path ([System.IO.Path]::GetTempPath()) ("slides319_" + [guid]::NewGuid().ToString("N"))

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($src, $dst)
  Get-ChildItem (Join-Path $dst "ppt\\\\slides") -Filter "slide*.xml" |
    Sort-Object { [int]($_.BaseName -replace "\\D", "") } |
    ForEach-Object {
      Write-Output ("=== SLIDE " + ($_.BaseName -replace "\\D", "") + " ===")
      $content = Get-Content $_.FullName -Raw
      [regex]::Matches($content, "<a:t>(.*?)</a:t>") | ForEach-Object {
        [System.Net.WebUtility]::HtmlDecode($_.Groups[1].Value)
      }
      Write-Output ""
    }
} finally {
  if (Test-Path $dst) {
    Remove-Item -LiteralPath $dst -Recurse -Force
  }
}
`;

  execFileSync("powershell", ["-NoProfile", "-Command", script], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
