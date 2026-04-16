@echo off
cd /d "%~dp0"

:: 直接传参：svn-update.bat "仓库名"
if not "%~1"=="" (
    node tools/svn-update.js "%~1"
    pause
    exit /b
)

:: 无参数时交互选择
set REPO_NAME=
set /p REPO_NAME=请输入仓库名称（留空=全部更新）:

if "%REPO_NAME%"=="" (
    node tools/svn-update.js
) else (
    node tools/svn-update.js "%REPO_NAME%"
)
pause
