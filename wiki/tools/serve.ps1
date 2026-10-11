<#
  Serves the repo at http://localhost:8000 so the wiki can load its JSON files (double-clicking the HTML cannot).
      powershell -ExecutionPolicy Bypass -File wiki\tools\serve.ps1
  Then open http://localhost:8000/wiki/ . Press Ctrl+C to stop.
#>
param([int]$Port = 8000)
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.md'='text/markdown; charset=utf-8'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.gif'='image/gif'; '.svg'='image/svg+xml'; '.ico'='image/x-icon' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/wiki/"
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
        $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
        $res = $ctx.Response
        if ((Test-Path $path -PathType Container)) {
            if (-not $ctx.Request.Url.AbsolutePath.EndsWith('/')) { $res.Redirect($ctx.Request.Url.AbsolutePath + '/'); $res.Close(); continue }
            $path = Join-Path $path 'index.html'
        }
        if ($path.StartsWith($root) -and (Test-Path $path -PathType Leaf)) {
            $bytes = [IO.File]::ReadAllBytes($path)
            $ext = [IO.Path]::GetExtension($path).ToLower()
            $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
            $res.Headers.Add('Cache-Control', 'no-cache')
            $res.ContentLength64 = $bytes.Length
            if ($ctx.Request.HttpMethod -ne 'HEAD') {
                try { $res.OutputStream.Write($bytes, 0, $bytes.Length) } catch { }
            }
        } else {
            $res.StatusCode = 404
        }
        try { $res.Close() } catch { }
    }
} finally { $listener.Stop() }
