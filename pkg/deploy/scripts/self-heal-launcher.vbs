' Launcher for the self-heal patrol. Startup only allows shortcuts here, so the shortcut
' points at wscript.exe running this file; the patrol itself runs with a hidden window.
q = Chr(34)
script = "D:\Vibe_coding-Project\autoAgentloop\deploy\scripts\self-heal-loop.ps1"
Set sh = CreateObject("WScript.Shell")
sh.Run q & "powershell.exe" & q & " -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & q & script & q, 0, False
