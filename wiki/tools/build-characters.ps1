<#
  Builds wiki/data/characters/ from wiki/data/story.md: one <name>.json per "Luma <Name>" write-up in the
  character tabs, with the fields of the Guardian template (data/templates.json) in template order,
  plus characters/index.json listing them all.
  update-story.ps1 runs this automatically; run it on its own with:
      powershell -ExecutionPolicy Bypass -File wiki\tools\build-characters.ps1

  - Private template fields, and fields hidden in wiki.json (hideFields) or branches.json (hiddenFields), are left out.
  - Empty fields are kept as "" so every file matches the template; the wiki does not display them.
  - Labels that are not in the template go under "other".
  - "gallery" is yours: whatever you add to a character's file is kept when the file is rebuilt.
#>
$ErrorActionPreference = 'Stop'
$wiki = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
$read = { param($p) [IO.File]::ReadAllText((Join-Path $wiki $p), $utf8) }

$cfg = & $read 'data\wiki.json' | ConvertFrom-Json
$branches = & $read 'data\branches.json' | ConvertFrom-Json
$layout = & $read 'data\lore-layout.json' | ConvertFrom-Json
$templates = & $read 'data\templates.json' | ConvertFrom-Json
$hide = @(@($cfg.hideFields) + @($branches.hiddenFields) | Where-Object { $_ } | ForEach-Object { $_.ToLower() })

# The Guardian template, in order. A field is hidden when it is private or any part of its name is hidden ("Breast Size/Ding Dong Size").
$tfields = @($templates.guardian.fields)
$fields = @($tfields | Where-Object { -not $_.private -and -not (@($_.label -split '/' | Where-Object { $hide -contains $_.Trim().ToLower() }).Count) } | ForEach-Object { $_.label })

# Doc label (lower case, without any "(...)") -> template field.
$alias = @{}
foreach ($f in $fields) { $alias[($f -replace '\s*\(.*?\)', '').ToLower()] = $f }
@{
    'original guardian name' = 'Guardian Name'; 'disciples' = 'Disciple'; 'personality examples' = 'Personality Example'
    'core idea' = 'Core Idea of character'; 'artefacts' = 'Artefact'; 'based at' = 'Stationed at'; 'weapon' = 'Weapon/Medium'
    'transformation speech' = 'Transformation Phrase'; 'evolve date' = 'Evolution Date'; 'status' = 'Guardian Status'
}.GetEnumerator() | ForEach-Object { if ($fields -contains $_.Value) { $alias[$_.Key] = $_.Value } }
$listFields = @($tfields | Where-Object { $_.type -eq 'list' } | ForEach-Object { $_.label })
# Inside these, a line like "First Floor: ..." is part of the text, not a new field.
$longFields = @($tfields | Where-Object { $_.type -eq 'long' -or $_.type -eq 'list' } | ForEach-Object { $_.label })

function Clean([string]$s) {
    $s = $s -replace '\\<\\!--.*?--\\>', '' -replace '<!--.*?-->', ''
    $s = $s -replace '\*\*', '' -replace '~~', '' -replace '\\([\\`*_{}\[\]()#+\-.!<>|])', '$1'
    return $s.Trim()
}
function IsEmpty([string]$v) { return ($v -replace '[\s\-–—“”"]', '') -eq '' }
function LumaNames([string]$heading) {
    $h = (Clean $heading) -replace '\(.*?\)', ''
    return @($h -split '/' | ForEach-Object { if ($_.Trim() -match '^Luma\s+(\S.*)$') { $Matches[1].Trim() } } | Where-Object { $_ })
}

$story = & $read 'data\story.md'
$parts = [regex]::Split($story, '(?m)^<!--\s*tab:\s*(.*?)\s*-->\s*$')
$charTabs = @($layout.characterTabs)
$out = New-Object System.Collections.Generic.List[object]
$fieldRe = '^\s*(?:\(if any\)\s*)?([A-Z][A-Za-z /''&,.-]{0,40}?)\s*(?:\([^)]*\))?\s*:\s*(.*)$'

for ($t = 1; $t -lt $parts.Count; $t += 2) {
    $tab = $parts[$t].Trim()
    if ($charTabs -notcontains $tab) { continue }
    $group = $tab; $base = ''; $cur = $null; $field = $null
    $finish = {
        if ($cur) {
            $o = [ordered]@{}
            foreach ($f in $fields) {
                if ($listFields -contains $f) { $o[$f] = @($cur.values[$f] | Where-Object { -not (IsEmpty $_) }) }
                else { $v = ($cur.values[$f] -join "`n").Trim(); $o[$f] = if (IsEmpty $v) { '' } else { $v } }
            }
            $other = [ordered]@{}
            foreach ($k in $cur.other.Keys) { $v = ($cur.other[$k] -join "`n").Trim(); if (-not (IsEmpty $v)) { $other[$k] = $v } }
            $out.Add([ordered]@{ name = $cur.names[0]; names = $cur.names; type = 'guardian'; group = $cur.group; base = $cur.base; tab = $tab; profile = $o; other = $other })
        }
    }
    foreach ($raw in ($parts[$t + 1] -split "`r?`n")) {
        $h = [regex]::Match($raw, '^(#{1,6})\s+(.*)$')
        if ($h.Success) {
            $names = @(LumaNames $h.Groups[2].Value)
            $level = $h.Groups[1].Value.Length
            if ($names.Count) {
                . $finish
                $cur = @{ names = $names; level = $level; group = $group; base = $base; values = @{}; labeled = @{}; other = [ordered]@{} }; $field = $null
                continue
            }
            $title = Clean $h.Groups[2].Value
            # A heading at the write-up's own level that names no one (like an unnamed "## Luma") ends it.
            if ($cur -and $level -le $cur.level -and $level -gt 1) { . $finish; $cur = $null; $field = $null; continue }
            if ($h.Groups[1].Value.Length -eq 1) {
                . $finish; $cur = $null; $field = $null
                $m = [regex]::Match($title, '^(.*?)\s*[-–—]\s*Based?\s+in\s+(.*)$', 'IgnoreCase')
                if ($m.Success) { $group = $m.Groups[1].Value.Trim(); $base = $m.Groups[2].Value.Trim() } else { $group = $title; $base = '' }
                continue
            }
            if ($cur -and $title) {
                # A sub-heading inside a write-up becomes a field of that name.
                $key = $alias[($title -replace '\s*\(.*?\)', '').ToLower()]
                if ($key) { $field = $key } else { $field = "other:$title"; $cur.other[$title] = @() }
            }
            continue
        }
        if (-not $cur) { continue }
        $line = Clean $raw
        if (-not $line) { continue }
        if ($line -match '^-{3,}$') { $field = $null; continue }
        $m = [regex]::Match($line, $fieldRe)
        $key = if ($m.Success) { $alias[$m.Groups[1].Value.Trim().ToLower()] } else { $null }
        # The same label again (like each victim's "Gender:" in a list) belongs to the text above it.
        if ($key -and $cur.labeled.ContainsKey($key)) {
            if ($field -and $field.StartsWith('other:')) { $cur.other[$field.Substring(6)] += $line }
            elseif ($field -and $longFields -contains $field) { $cur.values[$field] += $line }
            continue
        }
        if ($key) {
            $field = $key; $cur.labeled[$key] = $true
            if (-not $cur.values.ContainsKey($key)) { $cur.values[$key] = @() }
            $v = $m.Groups[2].Value.Trim()
            if ($v) { $cur.values[$key] += $v }
            continue
        }
        # A label with nothing after it ("Victims:", "His abilities included:") collects everything below it.
        $inLong = $field -and (($longFields -contains $field) -or ($cur.open -and $field -eq $cur.open))
        if ($m.Success -and -not $inLong -and $m.Groups[1].Value -notmatch '^https?$') {
            $label = $m.Groups[1].Value.Trim(); $field = "other:$label"
            if (-not $cur.other.Contains($label)) { $cur.other[$label] = @() }
            if ($m.Groups[2].Value.Trim()) { $cur.other[$label] += $m.Groups[2].Value.Trim() } else { $cur.open = $field }
            continue
        }
        if (-not $field) { continue }
        $bullet = [regex]::Match($line, '^[-*•]\s*(.*)$')
        if ($field.StartsWith('other:')) { $cur.other[$field.Substring(6)] += $line; continue }
        if (-not $cur.values.ContainsKey($field)) { $cur.values[$field] = @() }
        if ($listFields -contains $field) { $cur.values[$field] += $(if ($bullet.Success) { $bullet.Groups[1].Value.Trim() } else { $line }) }
        else { $cur.values[$field] += $line }
    }
    . $finish
}

# Windows PowerShell's ConvertTo-Json indents oddly and turns one-item lists into strings, so write it by hand.
function ToJson($v, [string]$pad = '') {
    $in = $pad + ' '
    if ($null -eq $v) { return 'null' }
    if ($v -is [string]) {
        $s = $v -replace '\\', '\\' -replace '"', '\"' -replace "`r", '' -replace "`n", '\n' -replace "`t", '\t'
        return '"' + $s + '"'
    }
    if ($v -is [bool]) { return $v.ToString().ToLower() }
    if ($v -is [ValueType]) { return [string]$v }
    if ($v -is [System.Management.Automation.PSCustomObject]) {
        $d = [ordered]@{}; foreach ($p in $v.PSObject.Properties) { $d[$p.Name] = $p.Value }; $v = $d
    }
    if ($v -is [System.Collections.IDictionary]) {
        if (-not $v.Count) { return '{}' }
        return "{`n" + (($v.Keys | ForEach-Object { $in + (ToJson ([string]$_)) + ': ' + (ToJson $v[$_] $in) }) -join ",`n") + "`n$pad}"
    }
    if ($v -is [System.Collections.IEnumerable]) {
        $items = @($v)
        if (-not $items.Count) { return '[]' }
        if (@($items | Where-Object { $_ -isnot [string] }).Count -eq 0 -and ($items -join '').Length -lt 120) {
            return '[' + (($items | ForEach-Object { ToJson $_ }) -join ', ') + ']'
        }
        return "[`n" + (($items | ForEach-Object { $in + (ToJson $_ $in) }) -join ",`n") + "`n$pad]"
    }
    return [string]$v
}
function Slug([string]$s) { (($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '').ToLower() -replace '[^a-z0-9]+', '-').Trim('-') }

$dir = Join-Path $wiki 'data\characters'
New-Item -ItemType Directory -Force $dir | Out-Null
$index = New-Object System.Collections.Generic.List[object]
$written = @{}
foreach ($c in $out) {
    $file = (Slug $c.name) + '.json'
    $path = Join-Path $dir $file
    # Keep the gallery (and a chosen portrait) that were added to this file by hand.
    $gallery = @(); $image = ''
    if (Test-Path $path) {
        $old = [IO.File]::ReadAllText($path, $utf8) | ConvertFrom-Json
        if ($old.gallery) { $gallery = @($old.gallery) }
        if ($old.image) { $image = [string]$old.image }
    }
    $entry = [ordered]@{
        _help = 'Built from the story doc by tools/build-characters.ps1. Edit the Google Doc for profile text; only "image" and "gallery" are kept when this file is rebuilt. gallery items: {"src": "images/characters/<name>/file.png", "caption": "..."}.'
    }
    foreach ($k in $c.Keys) { $entry[$k] = $c[$k] }
    $entry.image = $image
    $entry.gallery = $gallery
    [IO.File]::WriteAllText($path, (ToJson $entry) + "`n", $utf8)
    $written[$file] = $true
    $portrait = if ($image) { $image } elseif ($gallery.Count) { [string]$gallery[0].src } else { '' }
    $index.Add([ordered]@{ name = $c.name; names = $c.names; type = $c.type; file = $file; group = $c.group; image = $portrait })
}
$idx = [ordered]@{
    _help = 'List of character files in this folder, built by tools/build-characters.ps1. fields = the Guardian template fields each file uses, in order.'
    fields = $fields
    characters = $index.ToArray()
}
[IO.File]::WriteAllText((Join-Path $dir 'index.json'), (ToJson $idx) + "`n", $utf8)
$stale = @(Get-ChildItem $dir -Filter *.json | Where-Object { $_.Name -ne 'index.json' -and -not $written[$_.Name] })
Write-Host "Wrote $dir : $($out.Count) character files + index.json, $($fields.Count) template fields."
if ($stale.Count) { Write-Host "Not in the doc any more (left in place, delete them if they are not needed): $($stale.Name -join ', ')" }
