#!/bin/bash
# YAYA 语音服务启动脚本 (Linux/Mac)

echo "正在启动 YAYA 语音服务..."

# 设置代理（如果需要访问 Edge-TTS）
export https_proxy=http://192.168.243.93:10808
export http_proxy=http://192.168.243.93:10808

echo "代理已配置: $https_proxy"

# 激活虚拟环境（如果使用）
# source venv/bin/activate

# 启动服务
python yaya_voice_server_simple.py
