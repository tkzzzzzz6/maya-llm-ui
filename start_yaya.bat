@echo off
REM YAYA 语音服务启动脚本 (Windows)

echo ========================================
echo   YAYA 语音服务启动脚本
echo ========================================
echo.

REM 设置代理（如果需要访问 Edge-TTS）
set https_proxy=http://192.168.243.93:10808
set http_proxy=http://192.168.243.93:10808
echo 代理已配置: %https_proxy%
echo.

REM 激活 conda 环境（如果使用 conda）
REM call conda activate llm

echo 选择要启动的版本:
echo [1] 完整版 (SenseVoice + Edge-TTS) - 推荐
echo [2] 简化版 (Google STT + Edge-TTS)
echo.

set /p choice="请输入选择 (1/2): "

if "%choice%"=="1" (
    echo 正在启动完整版 YAYA 服务...
    python yaya_voice_server_full.py
) else if "%choice%"=="2" (
    echo 正在启动简化版 YAYA 服务...
    python yaya_voice_server_simple.py
) else (
    echo 无效选择，启动完整版...
    python yaya_voice_server_full.py
)

pause
