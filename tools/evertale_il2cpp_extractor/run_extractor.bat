@echo off
setlocal
echo Evertale IL2CPP Runtime Extractor
echo.

if "%~1"=="" (
  echo Drag an APK/XAPK/APKM/ZIP onto this BAT file, or run:
  echo run_extractor.bat "Evertale.xapk"
  pause
  exit /b 1
)

python evertale_il2cpp_extractor.py "%~1" --out il2cpp_output
pause
