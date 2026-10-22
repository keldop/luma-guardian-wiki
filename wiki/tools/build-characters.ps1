<#
  Builds the wiki's character data from a cleaned copy of the characters doc (LG Characters):
    - data/characters/<name>.json  one per "Luma <Name>" write-up, fields in the order of the Guardian template
    - data/characters/index.json   the list of them
    - data/people.json             each team (intro text and members) and the tabs with no write-ups (Civilians)
  update-story.ps1 -CharactersSource runs this with the cleaned copy; nothing else of the doc is saved in the repo.

  - Private template fields, and fields hidden in wiki.json (hideFields) or branches.json (hiddenFields), are left out.
  - Empty fields are kept as "" so every file matches the template; the wiki does not display them.
  - Labels that are not in the template go under "other".
  - "image" and "gallery" are yours: whatever you add to a character's file is kept when the file is rebuilt.
#>
param([Parameter(Mandatory = $true)][string]$Source)
$ErrorActionPreference = 'Stop'
$wiki = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
$read = { param($p) [IO.File]::ReadAllText((Join-Path $wiki $p), $utf8) }

$cfg = & $read 'data\wiki.json' | ConvertFrom-Json
$branches = & $read 'data\branches.json' | ConvertFrom-Json
$templates = & $read 'data\templates.json' | ConvertFrom-Json
$hide = @(@($cfg.hideFields) + @($branches.hiddenFields) | Where-Object { $_ } | ForEach-Object { $_.ToLower() })

# One template (data/templates.json), ready for reading the doc: its public fields in order, which doc labels
# mean which field, and which fields are lists or long text. A field is hidden when it is private or any part
# of its name is hidden ("Breast Size/Ding Dong Size").
function TemplateInfo($tpl, [hashtable]$extra) {
    $tf = @($tpl.fields)
    $fields = @($tf | Where-Object { -not $_.private -and -not (@($_.label -split '/' | Where-Object { $hide -contains $_.Trim().ToLower() }).Count) } | ForEach-Object { $_.label })
    # Doc label (lower case, without any "(...)") -> template field.
    $alias = @{}
    foreach ($f in $fields) { $alias[($f -replace '\s*\(.*?\)', '').ToLower()] = $f }
    foreach ($k in $extra.Keys) { if ($fields -contains $extra[$k]) { $alias[$k] = $extra[$k] } }
    return @{
        fields = $fields; alias = $alias
        list = @($tf | Where-Object { $_.type -eq 'list' } | ForEach-Object { $_.label })
        # Inside these, a line like "First Floor: ..." is part of the text, not a new field.
        long = @($tf | Where-Object { $_.type -eq 'long' -or $_.type -eq 'list' } | ForEach-Object { $_.label })
    }
}
$TG = TemplateInfo $templates.guardian @{
    'original guardian name' = 'Guardian Name'; 'disciples' = 'Disciple'; 'personality examples' = 'Personality Example'
    'core idea' = 'Core Idea of character'; 'artefacts' = 'Artefact'; 'based at' = 'Stationed at'; 'weapon' = 'Weapon/Medium'
    'transformation speech' = 'Transformation Phrase'; 'evolve date' = 'Evolution Date'; 'status' = 'Guardian Status'
}
$TC = TemplateInfo $templates.civilian @{
    'civilian name' = 'Full Name'; 'degree' = 'Education'; 'civilian occupation' = 'Occupation'
    'relationship status' = 'Relationship'; 'personality examples' = 'Personality Example'
}
$fields = $TG.fields

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

$doc = [IO.File]::ReadAllText((Resolve-Path $Source), $utf8) -replace "`r`n?", "`n"
$parts = [regex]::Split($doc, '(?m)^<!--\s*tab:\s*(.*?)\s*-->\s*$')
$out = New-Object System.Collections.Generic.List[object]
$teams = New-Object System.Collections.Generic.List[object]
$civGroups = New-Object System.Collections.Generic.List[object]
$looseTabs = New-Object System.Collections.Generic.List[object]
$fieldRe = '^\s*(?:\(if any\)\s*)?([A-Z][A-Za-z /''&,.-]{0,40}?)\s*(?:\([^)]*\))?\s*:\s*(.*)$'

for ($t = 1; $t -lt $parts.Count; $t += 2) {
    $tab = $parts[$t].Trim()
    # The Civilians tab: every "## Name" is a civilian, read with the Civilian template.
    $isCiv = $tab -match 'civilian'
    if ($isCiv) { $groupList = $civGroups } else { $groupList = $teams }
    $group = $tab; $base = ''; $cur = $null; $field = $null
    # Teams: "# Flower Sisters - Base in Singapore", its intro lines, then its write-ups. A tab with no team heading is its own team.
    $team = $null; $intro = $false; $found = 0
    $finish = {
        if ($cur) {
            $tpl = $cur.T
            $o = [ordered]@{}
            foreach ($f in $tpl.fields) {
                if ($tpl.list -contains $f) { $o[$f] = @($cur.values[$f] | Where-Object { -not (IsEmpty $_) }) }
                else { $v = ($cur.values[$f] -join "`n").Trim(); $o[$f] = if (IsEmpty $v) { '' } else { $v } }
            }
            $other = [ordered]@{}
            foreach ($k in $cur.other.Keys) { $v = ($cur.other[$k] -join "`n").Trim(); if (-not (IsEmpty $v)) { $other[$k] = $v } }
            $out.Add([ordered]@{ name = $cur.names[0]; names = $cur.names; type = $cur.type; group = $cur.group; base = $cur.base; tab = $tab; profile = $o; other = $other })
        }
    }
    foreach ($raw in ($parts[$t + 1] -split "`r?`n")) {
        $h = [regex]::Match($raw, '^(#{1,6})\s+(.*)$')
        if ($h.Success) {
            $level = $h.Groups[1].Value.Length
            $title = Clean $h.Groups[2].Value
            $names = @(LumaNames $h.Groups[2].Value)
            # A civilian is any "## Name" heading that names someone (not "Luma", not a divider).
            if ($isCiv -and $level -eq 2 -and $title -and $title -notmatch '^-+$' -and $title -notmatch '^Luma$') { $names = @(($title -replace '\s*\(.*?\)', '').Trim()) }
            if ($names.Count -and -not ($cur -and $level -gt $cur.level)) {
                . $finish
                $cur = @{ names = $names; level = $level; group = $group; base = $base; values = @{}; labeled = @{}; other = [ordered]@{}
                          type = $(if ($isCiv) { 'civilian' } else { 'guardian' }); T = $(if ($isCiv) { $TC } else { $TG }) }; $field = $null
                if (-not $team) { $team = [ordered]@{ name = $group; base = $base; intro = ''; notes = ''; members = (New-Object System.Collections.Generic.List[string]) }; $groupList.Add($team) }
                foreach ($n in $names) { if (-not $team.members.Contains($n)) { $team.members.Add($n) } }
                $intro = $false; $found++
                continue
            }
            # A heading at the write-up's own level that names no one (like an unnamed "## Luma") ends it.
            if ($cur -and $level -le $cur.level -and $level -gt 1) { . $finish; $cur = $null; $field = $null; continue }
            if ($h.Groups[1].Value.Length -eq 1) {
                . $finish; $cur = $null; $field = $null
                $m = [regex]::Match($title, '^(.*?)\s*[-–—]\s*Based?\s+in\s+(.*)$', 'IgnoreCase')
                if ($m.Success) { $group = $m.Groups[1].Value.Trim(); $base = $m.Groups[2].Value.Trim() } else { $group = $title; $base = '' }
                $team = [ordered]@{ name = $group; base = $base; intro = ''; notes = ''; members = (New-Object System.Collections.Generic.List[string]) }
                $groupList.Add($team); $intro = $true
                continue
            }
            if ($cur -and $title) {
                # A sub-heading inside a write-up becomes a field of that name.
                $key = $cur.T.alias[($title -replace '\s*\(.*?\)', '').ToLower()]
                if ($key) { $field = $key } else { $field = "other:$title"; $cur.other[$title] = @() }
            }
            continue
        }
        if (-not $cur) {
            # Text between a team heading and its first write-up is the team's intro (for civilians: a family list).
            if ($raw.Trim() -and $raw.Trim() -notmatch '^\\?-{3,}$' -and $team) {
                if ($intro) { $team.intro += $raw.TrimEnd() + "`n`n" }
                # Lines after a group's write-ups (family members not written up yet) are kept as the group's notes.
                elseif ($isCiv) { $team.notes += $raw.TrimEnd() + "`n`n" }
            }
            continue
        }
        $line = Clean $raw
        if (-not $line) { continue }
        if ($line -match '^-{3,}$') {
            # In the Civilians tab a divider ends the entry (what follows has no name of its own).
            if ($isCiv) { . $finish; $cur = $null }
            $field = $null; continue
        }
        $m = [regex]::Match($line, $fieldRe)
        # "Age (at the time of his death):" is not the age counted as of 2025: it becomes its own "Age at Death".
        if ($m.Success -and $m.Groups[1].Value.Trim() -ieq 'Age' -and $line -match '^\s*Age\s*\([^)]*\bdeath\b') {
            $field = 'other:Age at Death'
            if (-not $cur.other.Contains('Age at Death')) { $cur.other['Age at Death'] = @() }
            if ($m.Groups[2].Value.Trim()) { $cur.other['Age at Death'] += $m.Groups[2].Value.Trim() }
            continue
        }
        $key = if ($m.Success) { $cur.T.alias[$m.Groups[1].Value.Trim().ToLower()] } else { $null }
        # The same label again (like each victim's "Gender:" in a list) belongs to the text above it.
        if ($key -and $cur.labeled.ContainsKey($key)) {
            if ($field -and $field.StartsWith('other:')) { $cur.other[$field.Substring(6)] += $line }
            elseif ($field -and $cur.T.long -contains $field) { $cur.values[$field] += $line }
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
        $inLong = $field -and (($cur.T.long -contains $field) -or ($cur.open -and $field -eq $cur.open))
        if ($m.Success -and -not $inLong -and $m.Groups[1].Value -notmatch '^https?$') {
            $label = $m.Groups[1].Value.Trim(); $field = "other:$label"
            if (-not $cur.other.Contains($label)) { $cur.other[$label] = @() }
            if ($m.Groups[2].Value.Trim()) { $cur.other[$label] += $m.Groups[2].Value.Trim() } else { $cur.open = $field }
            continue
        }
        # A civilian's free paragraphs after short fields (like Claire Lim's write-up) are their background.
        if ($isCiv -and -not ($field -and ($field.StartsWith('other:') -or $cur.T.long -contains $field))) { $field = 'Background' }
        if (-not $field) { continue }
        $bullet = [regex]::Match($line, '^[-*•]\s*(.*)$')
        if ($field.StartsWith('other:')) { $cur.other[$field.Substring(6)] += $line; continue }
        if (-not $cur.values.ContainsKey($field)) { $cur.values[$field] = @() }
        if ($cur.T.list -contains $field) { $cur.values[$field] += $(if ($bullet.Success) { $bullet.Groups[1].Value.Trim() } else { $line }) }
        else { $cur.values[$field] += $line }
    }
    . $finish
    # A tab without any write-ups (Civilians) is kept whole as a Lore article.
    if (-not $found) { $looseTabs.Add([ordered]@{ title = $tab; md = $parts[$t + 1].Trim() }) }
}

. (Join-Path $PSScriptRoot 'tojson.ps1')
function Slug([string]$s) { (($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '').ToLower() -replace '[^a-z0-9]+', '-').Trim('-') }

$dir = Join-Path $wiki 'data\characters'
New-Item -ItemType Directory -Force $dir | Out-Null
$index = New-Object System.Collections.Generic.List[object]
$written = @{}
foreach ($c in $out) {
    $file = (Slug $c.name) + '.json'
    # A civilian sharing a Guardian's name gets their own file.
    if ($written[$file]) { $file = (Slug $c.name) + '-' + $c.type + '.json' }
    $path = Join-Path $dir $file
    # Keep the gallery (and a chosen portrait) that were added to this file by hand.
    $gallery = @(); $image = ''
    if (Test-Path $path) {
        $old = [IO.File]::ReadAllText($path, $utf8) | ConvertFrom-Json
        if ($old.gallery) { $gallery = @($old.gallery) }
        if ($old.image) { $image = [string]$old.image }
    }
    $entry = [ordered]@{}
    foreach ($k in $c.Keys) { $entry[$k] = $c[$k] }
    $entry.image = $image
    $entry.gallery = $gallery
    [IO.File]::WriteAllText($path, (ToJson $entry) + "`n", $utf8)
    $written[$file] = $true
    $portrait = if ($image) { $image } elseif ($gallery.Count) { [string]$gallery[0].src } else { '' }
    # A short line for cards: a civilian's role in the story (or occupation), a Guardian's role.
    $subtitle = if ($c.type -eq 'civilian') { @($c.profile['Role in Story'], $c.profile['Occupation']) | Where-Object { $_ } | Select-Object -First 1 } else { $c.profile['Primary Role'] }
    # A Guardian's element, from the first part of the Branch Theme or the Original Element.
    $element = ''
    if ($c.type -eq 'guardian') {
        $src = (([string]$c.profile['Branch Theme']) -split '[-–—\s]')[0]
        if (-not $src) { $src = (([string]$c.profile['Original Element']) -split '[-–—\s]')[0] }
        $element = @('Fire', 'Earth', 'Water', 'Air') | Where-Object { $_ -eq $src } | Select-Object -First 1
    }
    $index.Add([ordered]@{ name = $c.name; names = $c.names; type = $c.type; file = $file; group = $c.group; element = [string]$element; subtitle = [string]$subtitle; image = $portrait })
}
$idx = [ordered]@{
    _help = 'List of character files in this folder, built from the characters doc by tools/build-characters.ps1. Edit the Google Doc for profile text; in each character file only "image" and "gallery" are yours, and they are kept when the file is rebuilt. gallery items: {"src": "images/characters/<name>/file.png", "caption": "..."}. fields / civilianFields = the template fields each Guardian / civilian file uses, in order.'
    fields = $TG.fields
    civilianFields = $TC.fields
    characters = $index.ToArray()
}
[IO.File]::WriteAllText((Join-Path $dir 'index.json'), (ToJson $idx) + "`n", $utf8)
$stale = @(Get-ChildItem $dir -Filter *.json | Where-Object { $_.Name -ne 'index.json' -and -not $written[$_.Name] })
$nCiv = @($out | Where-Object { $_.type -eq 'civilian' }).Count
Write-Host "Wrote $dir : $($out.Count - $nCiv) Guardian + $nCiv civilian files + index.json."
if ($stale.Count) { Write-Host "Not in the doc any more (left in place, delete them if they are not needed): $($stale.Name -join ', ')" }

# Teams and civilian groups (with their intros and members), plus tabs with no write-ups, for the Lore pages and profile badges.
$asList = { param($groups) @($groups | Where-Object { $_.members.Count -or $_.intro.Trim() -or $_.notes.Trim() } | ForEach-Object {
    [ordered]@{ name = $_.name; base = $_.base; intro = $_.intro.Trim(); members = @($_.members); notes = $_.notes.Trim() }
}) }
$teamList = & $asList $teams
$civList = & $asList $civGroups
$people = [ordered]@{
    _help = 'Built from the characters doc by tools/build-characters.ps1. Do not edit by hand. teams: every team heading with its intro and members. civilians: civilian groups (members have their own files) and family lists (intro only). tabs: doc tabs without any write-ups, used as Lore articles.'
    teams = @($teamList | Where-Object { $_.members.Count })
    civilians = $civList
    tabs = $looseTabs.ToArray()
}
[IO.File]::WriteAllText((Join-Path $wiki 'data\people.json'), (ToJson $people) + "`n", $utf8)
Write-Host "Wrote data\people.json : $(@($people.teams).Count) teams, $($civList.Count) civilian groups, $($looseTabs.Count) other tab(s)."

# Keep branches.json (Branch tree, Characters list) in line with the doc.
& (Join-Path $PSScriptRoot 'sync-branches.ps1')
