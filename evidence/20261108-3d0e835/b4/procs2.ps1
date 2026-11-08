foreach ($id in @(12496,26076)) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
  if ($p) {
    $c = $p.CommandLine
    $tail = if ($c.Length -gt 200) { $c.Substring($c.Length-200) } else { $c }
    "PID=$id TAIL=$tail"
  }
}
