@echo off
rem The same program the POSIX launcher starts, for a Windows command prompt and for anything that can only run an
rem .exe or a .cmd. The arguments are handed on as they arrived; nothing here splits them again.
node --disable-warning=ExperimentalWarning "%~dp0agent-autoloop.ts" %*
