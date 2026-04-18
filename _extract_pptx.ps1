Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = 'C:\Users\anshu\WebstormProjects\cs319\slides319.pptx'
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

$slideEntries = $zip.Entries | Where-Object { $_.FullName -match 'ppt/slides/slide\d+\.xml$' } | Sort-Object {
    [int]([regex]::Match($_.FullName, 'slide(\d+)').Groups[1].Value)
}

foreach ($entry in $slideEntries) {
    $slideNum = [regex]::Match($entry.FullName, 'slide(\d+)').Groups[1].Value
    Write-Host "=== SLIDE $slideNum ==="

    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $content = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()

    $matches = [regex]::Matches($content, '<a:t>([^<]+)</a:t>')
    foreach ($m in $matches) {
        Write-Host $m.Groups[1].Value
    }
    Write-Host ""
}

$zip.Dispose()
