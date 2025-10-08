#!/bin/bash

echo "============================================"
echo "安装实时视频服务依赖"
echo "============================================"
echo ""

# Python 依赖
echo "安装 Python 依赖..."
pip install flask flask-cors flask-sock opencv-python numpy dashscope

echo ""
echo "✅ 依赖安装完成！"
echo ""
echo "启动服务:"
echo "  python qwen_video_server_realtime.py"
