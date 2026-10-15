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
