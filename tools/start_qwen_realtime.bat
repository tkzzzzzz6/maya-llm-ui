@echo off
chcp 65001
echo ========================================
echo Qwen-Omni 实时视频服务启动脚本
echo ========================================
echo.
echo 参考 vad_dash.py 的实时流式设计
echo 支持 WebSocket 实时视频+音频流
echo.

REM 设置 Dashscope API Key
REM set DASHSCOPE_API_KEY=sk-your-api-key-here

echo 正在启动实时视频服务...
echo 服务地址: ws://localhost:5003/ws/video
echo.

python qwen_video_server_realtime.py

pause
