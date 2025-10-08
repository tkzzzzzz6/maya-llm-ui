#!/bin/bash

echo "========================================"
echo "Qwen-Omni 视频服务启动脚本"
echo "========================================"
echo ""

# 设置 Dashscope API Key（如果需要）
# export DASHSCOPE_API_KEY=sk-your-api-key-here

# 设置代理（如果需要）
# export https_proxy=http://192.168.243.93:10808
# export http_proxy=http://192.168.243.93:10808

echo "正在启动 Qwen-Omni 视频服务..."
echo "服务地址: http://localhost:5002"
echo ""

python3 qwen_video_server.py
