@echo off
IF NOT EXIST .setup_complete (
    node setup.js
    IF ERRORLEVEL 1 (
        echo.
        echo Kurulum tamamlanamadi. Lutfen uyarilari dikkate aliniz.
        pause
        exit /b
    )
)
nodemon --watch src src/main.js