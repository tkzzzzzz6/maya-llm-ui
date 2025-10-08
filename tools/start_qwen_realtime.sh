#!/bin/bash

echo "========================================"
echo "Qwen-Omni 实时视频服务启动脚本"
echo "========================================"
echo ""
echo "参考 vad_dash.py 的实时流式设计"
echo "支持 WebSocket 实时视频+音频流"
echo ""

# 设置 Dashscope API Key (如果环境变量未设置)
if [ -z "$DASHSCOPE_API_KEY" ]; then
    echo "警告: DASHSCOPE_API_KEY 环境变量未设置"
    echo "请设置环境变量或在 .env.local 中配置"
    echo ""
    # export DASHSCOPE_API_KEY=sk-your-api-key-here
fi

echo "正在启动实时视频服务..."
echo "服务地址: ws://0.0.0.0:5003/ws/video"
echo "健康检查: http://0.0.0.0:5003/health"
echo ""

python qwen_video_server_realtime.py
