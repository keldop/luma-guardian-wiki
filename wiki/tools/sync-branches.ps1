<#
  Brings wiki/data/branches.json (Branch tree, Characters list) in line with the character files built from the
  characters doc (wiki/data/characters/). The doc wins: for every Guardian written up in the doc, branches.json gets
  the doc's branch, mentor, rank, role, team, guild, zodiac, location, status and disciples.
  Guardians only in branches.json (no write-up yet) are kept and listed. Run by build-characters.ps1; on its own:
      powershell -ExecutionPolicy Bypass -File wiki\tools\sync-branches.ps1 [-WhatIf]
#>
param([switch]$WhatIf)
$ErrorActionPreference = 'Stop'
$wiki = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
$bpath = Join-Path $wiki 'data\branches.json'
$b = [IO.File]::ReadAllText($bpath, $utf8) | ConvertFrom-Json
$cfg = [IO.File]::ReadAllText((Join-Path $wiki 'data\wiki.json'), $utf8) | ConvertFrom-Json
$hide = @(@($cfg.hideFields) + @($b.hiddenFields) | Where-Object { $_ } | ForEach-Object { $_.ToLower() })
$ELEMENTS = @('Fire', 'Earth', 'Water', 'Air')

# Dashes written as escapes: Windows PowerShell reads this file as ANSI, so literal en/em dashes would not match.
$DASH = '[–—]'
function Norm([string]$p) { (($p -replace $DASH, '-') -replace '\s*-\s*', '-').Trim().Trim('-') }
# One-line field value: first line only, no Markdown stars, no trailing ";", empty for "-", "Undecided" and the like.
function Clean($v) {
    $v = ((([string]$v) -split "`n")[0] -replace '\*', '').Trim().TrimEnd(';').Trim()
    if ($v -match ('^(-|' + $DASH + '|none|n/?a|undecided|unknown|tbd|\?)?$')) { '' } else { $v }
}
# A place for the map: "Japan; formerly spent time in Singapore." -> "Japan", "Singapore (before disappearance)" -> "Singapore".
function Place([string]$v) { ((Clean $v) -split '[;(]')[0].Trim().TrimEnd('.').Trim() }
# "Luma Coffea, Luma Fractal; Luma Iris are not officially registered." -> Coffea, Fractal, Iris.
# Only the first sentence counts, so "registered under Luma Lumen's mentorship" is not read as a disciple.
function DiscipleNames([string]$text) {
    $first = ([regex]::Split([string]$text, '\.\s'))[0]
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($m in [regex]::Matches($first, "Luma\s+([A-Z][A-Za-z]+(?:\s[A-Z][a-z]+)?)(?!['’]s)")) {
        $n = $m.Groups[1].Value.Trim()
        if (-not $out.Contains($n)) { $out.Add($n) }
    }
    return , $out.ToArray()
}

# Character files (Guardians only), by every name they go by. Files not in index.json are left over from
# characters the doc no longer has (renamed, like Blaze -> Pyro): their Guardians leave branches.json too.
$cdir = Join-Path $wiki 'data\characters'
$indexed = @{}
foreach ($r in ([IO.File]::ReadAllText((Join-Path $cdir 'index.json'), $utf8) | ConvertFrom-Json).characters) { $indexed[$r.file] = $true }
$gone = @{}; $goneFiles = @()
foreach ($f in Get-ChildItem $cdir -Filter *.json | Where-Object { $_.Name -ne 'index.json' -and -not $indexed[$_.Name] }) {
    $old = [IO.File]::ReadAllText($f.FullName, $utf8) | ConvertFrom-Json
    foreach ($n in @($old.names)) { $gone[[string]$n.ToLower()] = $true }
    $goneFiles += , @($f, $old)
}
$files = Get-ChildItem $cdir -Filter *.json | Where-Object { $_.Name -ne 'index.json' -and $indexed[$_.Name] } |
    ForEach-Object { [IO.File]::ReadAllText($_.FullName, $utf8) | ConvertFrom-Json } | Where-Object { $_.type -eq 'guardian' }
$docNow = @{}; foreach ($c in $files) { foreach ($n in $c.names) { $docNow[$n.ToLower()] = $true } }
$dropped = @($b.guardians | Where-Object { $gone[$_.name.ToLower()] -and -not $docNow[$_.name.ToLower()] } | ForEach-Object { $_.name })
if ($dropped.Count) { $b.guardians = @($b.guardians | Where-Object { $dropped -notcontains $_.name }) }
$byName = @{}
foreach ($g in $b.guardians) { $byName[$g.name.ToLower()] = $g }

$changes = New-Object System.Collections.Generic.List[string]
$added = New-Object System.Collections.Generic.List[object]
$pathOf = @{}
foreach ($g in $b.guardians) { if ($g.path) { $pathOf[$g.name.ToLower()] = $g.path } }

# Pass 1: branch paths from the doc's Branch Theme.
$zodiacs = @{}
foreach ($el in $b.zodiacRoots.PSObject.Properties) { foreach ($z in @($el.Value)) { $zodiacs[[string]$z.ToLower()] = $true } }
$plan = @()
foreach ($c in $files) {
    $p = $c.profile
    $theme = Norm (([string]$p.'Branch Theme') -split '/')[0]
    $name = $c.name
    # A theme that ends in another Guardian's name (Venom: "Earth-Life-Toxin") means a branch under that Guardian.
    # A theme ending in a word that is nobody's name (Demise: "Earth-Life-Extinct") is the branch's own name.
    $last = if ($theme) { $theme.Split('-')[-1] } else { '' }
    if ($theme -and $theme.Contains('-') -and -not ($c.names | Where-Object { $_ -ieq $last }) -and ($files | Where-Object { $_.names -contains $last })) { $theme = "$theme-$name" }
    # Zodiacs are the roots of their element: "Fire-Leo" stays "Fire", and their disciples stay where they are.
    if ($theme -and $zodiacs[$name.ToLower()]) { $theme = $theme.Split('-')[0] }
    $plan += , @($c, $theme)
}
foreach ($pair in $plan) { $c, $theme = $pair; if ($theme) { foreach ($n in $c.names) { if (-not $pathOf[$n.ToLower()] -or $n -ieq $c.name) { $pathOf[$n.ToLower()] = $theme } } } }
# No Branch Theme: under the mentor's branch (Quell under Enervate), if the mentor has one.
foreach ($pair in $plan) {
    $c, $theme = $pair
    if ($theme -or $pathOf[$c.name.ToLower()]) { continue }
    $m = [regex]::Match([string]$c.profile.Mentor, 'Luma\s+([A-Z][A-Za-z]+(?:\s[A-Z][a-z]+)?)')
    if ($m.Success -and $pathOf[$m.Groups[1].Value.ToLower()]) { $pathOf[$c.name.ToLower()] = $pathOf[$m.Groups[1].Value.ToLower()] + '-' + $c.name }
}

# Branches that were not updated in the doc when their mentor moved follow the mentor.
$followed = New-Object System.Collections.Generic.List[string]
$mentorOf = @{}; $discListOf = @{}
foreach ($c in $files) {
    $m = [regex]::Match([string]$c.profile.Mentor, 'Luma\s+([A-Z][A-Za-z]+(?:\s[A-Z][a-z]+)?)')
    if ($m.Success) { $mentorOf[$c.name.ToLower()] = $m.Groups[1].Value }
    $discListOf[$c.name.ToLower()] = [string[]](DiscipleNames $c.profile.Disciple)
}
$parentOf = { param($p) if ($p -and $p.Contains('-')) { $p.Substring(0, $p.LastIndexOf('-')) } else { '' } }
for ($round = 0; $round -lt 5; $round++) {
    $changedAny = $false
    foreach ($c in $files) {
        $k = $c.name.ToLower(); $p = $pathOf[$k]
        if (-not $p -or -not $p.Contains('-')) { continue }
        $segs = $p.Split('-'); $np = $p
        # 1. A parent branch named after a Guardian who now lives elsewhere: Earth-Mineral-Crystalis, with Mineral
        #    now at Earth-Geo-Mineral, becomes Earth-Geo-Mineral-Crystalis.
        for ($i = $segs.Count - 1; $i -ge 2; $i--) {
            $prefix = $segs[0..($i - 1)] -join '-'
            $owner = $pathOf[$segs[$i - 1].ToLower()]
            if ($owner -and $owner -ine $prefix -and ($files | Where-Object { $_.names -contains $segs[$i - 1] })) { $np = $owner + $p.Substring($prefix.Length); break }
        }
        # 2. A new mentor inserted between them and their old parent: Cedar's mentor Woodland now sits where
        #    Cedar sat (under Verdant) and lists Cedar, so Cedar moves under Woodland.
        $mn = $mentorOf[$k]
        if ($np -eq $p -and $mn -and $pathOf[$mn.ToLower()]) {
            $mp = $pathOf[$mn.ToLower()]
            if ((& $parentOf $p) -ieq (& $parentOf $mp) -and ($discListOf[$mn.ToLower()] -contains $c.name)) { $np = "$mp-$($segs[-1])" }
        }
        if ($np -ne $p) {
            $followed.Add("$($c.name): $p -> $np (follows their mentor)")
            foreach ($n in $c.names) { if ($pathOf[$n.ToLower()] -eq $p) { $pathOf[$n.ToLower()] = $np } }
            $changedAny = $true
        }
    }
    if (-not $changedAny) { break }
}

# Pass 2: every Guardian in the doc, field by field.
$rawDisc = @{}
$moved = @{}
foreach ($c in $files) {
    $p = $c.profile
    $status = (Clean $p.'Guardian Status').ToLower()
    $status = if ($status -match '^(deceased|retired)') { $Matches[1] } else { '' }
    $want = [ordered]@{
        path = [string]$pathOf[$c.name.ToLower()]
        rank = Clean $p.'Guardian Rank'
        mentor = Clean $p.Mentor
        role = Clean $p.'Primary Role'
        team = Clean $p.Team
        guild = Clean $p.Guild
        zodiac = Clean $p.Zodiac
        base = $(if (Place $p.'Stationed at') { Place $p.'Stationed at' } else { Place $c.base })
        status = $status
    }
    $disc = DiscipleNames $p.Disciple
    $g = $byName[$c.name.ToLower()]
    if (-not $g) {
        $g = [pscustomobject]@{ name = $c.name }
        $b.guardians += $g; $byName[$c.name.ToLower()] = $g; $added.Add($c.name)
    }
    foreach ($k in $want.Keys) {
        $old = [string]$g.$k
        $new = [string]$want[$k]
        # The doc leaving a field empty does not contradict anything: keep what branches.json knows.
        if (-not $new) { continue }
        if ($k -eq 'path' -and $old -and $old -ne $new) { $moved[$old] = $new }
        if ($old -ne $new) {
            if ($g.PSObject.Properties[$k]) { $g.$k = $new } else { $g | Add-Member -NotePropertyName $k -NotePropertyValue $new }
            if ($old -or $new) { $changes.Add("$($c.name): $k '$old' -> '$new'") }
        }
    }
    # Disciples are settled after branches are placed (pass 3).
    if ($disc.Count) { $rawDisc[$c.name.ToLower()] = $disc }
    # Old "no branch" notes go once a branch is known.
    if ($g.path) { foreach ($x in 'element', 'reason') { if ($g.PSObject.Properties[$x]) { $g.PSObject.Properties.Remove($x) } } }
    # Profile fields kept in branches.json: the doc's public ones (private fields never land here).
    $info = [ordered]@{}
    foreach ($prop in $p.PSObject.Properties) {
        $v = Clean ($(if ($prop.Value -is [array]) { $prop.Value -join '; ' } else { $prop.Value }))
        if ($v -and $hide -notcontains $prop.Name.ToLower() -and $prop.Name -notin 'Personality Example', 'Quotes', 'Background', 'Personality', 'Civilian Appearance', 'Guardian Appearance', 'Fever Behaviour', 'Intoxicated Behaviour', 'Transformation Phrase', 'Awakening Speech') { $info[($prop.Name -replace '\s*\(.*?\)', '')] = $v }
    }
    $g | Add-Member -NotePropertyName info -NotePropertyValue $info -Force
}
# Guardians the doc does not cover move with their mentor: Unnamed under Sage follows Sage to Earth-Essence-Sage.
$docSet = @{}; foreach ($c in $files) { foreach ($n in $c.names) { $docSet[$n.ToLower()] = 1 } }
foreach ($g in $b.guardians) {
    if ($docSet[$g.name.ToLower()] -or -not $g.path) { continue }
    foreach ($old in ($moved.Keys | Sort-Object Length -Descending)) {
        if ($g.path.StartsWith($old + '-', 'OrdinalIgnoreCase')) {
            $np = $moved[$old] + $g.path.Substring($old.Length)
            $changes.Add("$($g.name): path '$($g.path)' -> '$np' (moved with their mentor)")
            $g.path = $np; $pathOf[$g.name.ToLower()] = $np
            if ($g.info -and $g.info.PSObject.Properties['Branch Theme']) { $g.info.'Branch Theme' = $np }
            break
        }
    }
}
# Private fields (Height, Weight...) never stay in branches.json, even for Guardians the doc does not cover.
foreach ($g in $b.guardians) {
    if ($g.info -is [System.Management.Automation.PSCustomObject]) {
        foreach ($prop in @($g.info.PSObject.Properties)) { if ($hide -contains $prop.Name.ToLower()) { $g.info.PSObject.Properties.Remove($prop.Name) } }
    }
}

# Pass 3: branch list = existing order + every Guardian's branch (and its parents) + disciples' branches.
$list = New-Object System.Collections.Generic.List[string]
foreach ($x in $b.branches) { $list.Add($x) }
$needed = New-Object System.Collections.Generic.List[string]
$discOf = @()
# The doc's disciple list for Guardians written up there; the stored list for the rest (like Valour).
$discList = { param($g) if ($rawDisc[$g.name.ToLower()]) { @($rawDisc[$g.name.ToLower()]) } else { @($g.disciples | Where-Object { $_ }) } }
foreach ($g in $b.guardians) {
    if (-not $g.path) { continue }
    if ($g.path.Contains('-')) {
        $segs = $g.path.Split('-')
        for ($i = 2; $i -le $segs.Count; $i++) { $needed.Add(($segs[0..($i - 1)] -join '-')) }
    }
    # Zodiac roots (path "Fire") count too: their disciples start first-level branches.
    foreach ($d in (& $discList $g)) { if (-not $pathOf[$d.ToLower()]) { $discOf += , @($g.path, $d) } }
}
# A disciple with no write-up gets one branch, under one of the mentors that list them: the one already listed if
# there is one (Penumbra stays under Lumen even though Umbra also lists them), otherwise the first mentor.
# A branch under a mentor who no longer lists them is not kept, so moved disciples move with their mentor.
$mentorsOf = [ordered]@{}
$placedPath = @{}
foreach ($pair in $discOf) {
    $mp, $d = $pair
    if (-not $mentorsOf.Contains($d.ToLower())) { $mentorsOf[$d.ToLower()] = @{ name = $d; paths = New-Object System.Collections.Generic.List[string] } }
    $mentorsOf[$d.ToLower()].paths.Add($mp)
}
foreach ($k in $mentorsOf.Keys) {
    $d = $mentorsOf[$k].name; $paths = $mentorsOf[$k].paths
    $keep = @($paths | Where-Object { $mp = $_; $list | Where-Object { $_ -ieq "$mp-$d" } } | Select-Object -First 1)
    $placedAt = if ($keep.Count) { "$($keep[0])-$d" } else { "$($paths[0])-$d" }
    $needed.Add($placedAt); $placedPath[$d.ToLower()] = $placedAt
}
# Branches written out in full anywhere in a write-up (like each of Vacuum's victims: "Branch: Fire-Vitalis-Hearth"),
# unless that person already has a branch elsewhere (Willow is under Woodland now, not Verdant).
foreach ($c in $files) {
    $txt = (ConvertTo-Json -InputObject $c -Depth 6 -Compress) -replace '\\u2013|\\u2014', '-'
    foreach ($m in [regex]::Matches($txt, '\b(?:Fire|Earth|Water|Air)(?:\s*-\s*[A-Z][A-Za-z]+)+')) {
        $p = Norm $m.Value; $segs = $p.Split('-')
        $known = $(if ($pathOf[$segs[-1].ToLower()]) { $pathOf[$segs[-1].ToLower()] } else { $placedPath[$segs[-1].ToLower()] })
        if ($known -and $known -ine $p) { continue }
        for ($i = 2; $i -le $segs.Count; $i++) { $needed.Add(($segs[0..($i - 1)] -join '-')) }
    }
}
$newBranches = @()
foreach ($p in $needed) {
    if ($list | Where-Object { $_ -ieq $p }) { continue }
    $parent = $p.Substring(0, $p.LastIndexOf('-')); $at = -1
    for ($i = 0; $i -lt $list.Count; $i++) { if ($list[$i] -ieq $parent -or $list[$i].StartsWith($parent + '-', 'OrdinalIgnoreCase')) { $at = $i } }
    if ($at -lt 0) { $el = $p.Split('-')[0]; for ($i = 0; $i -lt $list.Count; $i++) { if ($list[$i].StartsWith($el + '-', 'OrdinalIgnoreCase')) { $at = $i } } }
    $list.Insert($at + 1, $p); $newBranches += $p
}
# Branches nobody needs any more (left behind when the doc moved or renamed someone).
$neededSet = @{}; foreach ($p in $needed) { $neededSet[$p.ToLower()] = 1 }
$unused = @($list | Where-Object { -not $neededSet[$_.ToLower()] })

# Disciple lists: a disciple without a write-up stays only with the mentor whose branch they sit under, so the
# Branch tree draws them once (Umbra also lists Penumbra, but Penumbra's branch is under Lumen).
foreach ($g in $b.guardians) {
    $src = & $discList $g
    $keep = @($src | Where-Object { $pathOf[$_.ToLower()] -or ($g.path -and $neededSet[("$($g.path)-$_").ToLower()]) })
    $oldD = @($g.disciples | Where-Object { $_ }) -join ', '
    if ($oldD -ne ($keep -join ', ')) {
        if ($keep.Count) { $g | Add-Member -NotePropertyName disciples -NotePropertyValue $keep -Force }
        elseif ($g.PSObject.Properties['disciples']) { $g.PSObject.Properties.Remove('disciples') }
        $changes.Add("$($g.name): disciples [$oldD] -> [$($keep -join ', ')]")
    }
}

$docNames = @{}; foreach ($c in $files) { foreach ($n in $c.names) { $docNames[$n.ToLower()] = 1 } }
$notInDoc = @($b.guardians | Where-Object { -not $docNames[$_.name.ToLower()] } | ForEach-Object { $_.name })
if ($followed.Count) { Write-Host "Moved to follow their mentor:"; $followed | ForEach-Object { Write-Host "  $_" } }

Write-Host "Guardian fields changed: $($changes.Count)"; $changes | ForEach-Object { Write-Host "  $_" }
Write-Host "Guardians added from the doc: $($added -join ', ')"
Write-Host "Branches added: $($newBranches -join ', ')"
Write-Host "Branches no Guardian or disciple needs: $($unused -join ', ')"
Write-Host "In branches.json but not written up in the doc: $($notInDoc -join ', ')"
Write-Host "Removed (no longer in the doc): $($dropped -join ', ')"
if ($WhatIf) { return }
# Their old character files go too, unless pictures were added to them.
foreach ($pair in $goneFiles) {
    $f, $old = $pair
    if (@($old.gallery).Count -or $old.image) { Write-Host "Kept $($f.Name): it has pictures. Move them to the new file, then delete it." }
    else { Remove-Item $f.FullName; Write-Host "Deleted $($f.Name)" }
}

# Unused branches are removed; the doc no longer names them.
$b.branches = @($list | Where-Object { $neededSet[$_.ToLower()] })
. (Join-Path $PSScriptRoot 'tojson.ps1')
[IO.File]::WriteAllText($bpath, (ToJson $b) + "`n", $utf8)
Write-Host "Wrote $bpath"
