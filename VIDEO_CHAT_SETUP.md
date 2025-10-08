# 视频对话功能设置指南

本文档说明如何配置和使用 Qwen-Omni 视频对话功能。

## 功能概述

视频对话功能允许用户：
- 使用摄像头录制视频
- 将视频发送到 Qwen-Omni AI 模型进行分析
- 获取 AI 对视频内容的理解和回答
- 支持多摄像头选择（包括物理摄像头和虚拟摄像头如 Iriun Webcam）

## 架构说明

```
前端 (Next.js)
    ↓
Next.js API 路由 (/api/video/analyze)
    ↓
Python Flask 服务 (qwen_video_server.py)
    ↓
Qwen-Omni API (Dashscope)
```

## 安装步骤

### 1. 安装 Python 依赖

```bash
pip install flask flask-cors opencv-python numpy dashscope
```

### 2. 配置环境变量

在 `.env.local` 文件中添加：

```bash
# Qwen Video 服务地址
QWEN_VIDEO_SERVICE_URL=http://localhost:5002

# Dashscope API Key (可选，如果已在 qwen_video_server.py 中硬编码)
DASHSCOPE_API_KEY=sk-your-api-key-here
```

### 3. 启动 Qwen Video 服务

**Windows:**
```bash
start_qwen_video.bat
```

**Linux/Mac:**
```bash
./start_qwen_video.sh
```

**或者直接运行:**
```bash
python qwen_video_server.py
```

服务将在 `http://localhost:5002` 启动。

### 4. 启动 Next.js 前端

```bash
npm run dev
```

## 使用方法

### 在前端界面使用

1. 打开聊天界面
2. 点击顶部的视频图标 📹 切换到视频聊天模式
3. 如果有多个摄像头，从下拉菜单中选择要使用的摄像头
4. 点击录制按钮开始录制视频
5. 录制完成后，点击停止按钮
6. 视频会自动发送到 Qwen-Omni 进行分析
7. AI 的分析结果会显示在聊天记录中

### API 接口说明

#### 1. 一次性视频分析

**端点:** `POST /api/video/analyze`

**请求:**
```typescript
const formData = new FormData()
formData.append('video', videoBlob, 'recording.webm')
formData.append('question', '请分析这个视频中的内容')

const response = await fetch('/api/video/analyze', {
  method: 'POST',
  body: formData
})
```

**响应:**
```json
{
  "analysis": "视频分析结果...",
  "transcript": "音频转录文本..."
}
```

#### 2. 会话管理（高级用法）

**创建会话:**
```typescript
const response = await fetch('/api/video/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    instructions: '你是一个视频分析专家'
  })
})
const { session_id } = await response.json()
```

**关闭会话:**
```typescript
await fetch(`/api/video/session?sessionId=${session_id}`, {
  method: 'DELETE'
})
```

## 后端服务 API

### Qwen Video Server (Port 5002)

#### 健康检查
```bash
GET http://localhost:5002/health
```

#### 一次性视频分析
```bash
POST http://localhost:5002/api/analyze-video
Content-Type: multipart/form-data

{
  video: File,
  audio: File (optional),
  question: String (optional)
}
```

#### 会话管理

**创建会话:**
```bash
POST http://localhost:5002/api/session/create
Content-Type: application/json

{
  "instructions": "系统提示词"
}
```

**发送视频帧:**
```bash
POST http://localhost:5002/api/session/{session_id}/video
Content-Type: application/json

{
  "frame": "base64_encoded_image"
}
```

**发送音频:**
```bash
POST http://localhost:5002/api/session/{session_id}/audio
Content-Type: application/json

{
  "audio": "base64_encoded_audio"
}
```

**获取响应（流式）:**
```bash
GET http://localhost:5002/api/session/{session_id}/response
```

**关闭会话:**
```bash
POST http://localhost:5002/api/session/{session_id}/close
```

## 性能优化建议

### 视频处理配置

在 `qwen_video_server.py` 中可以调整以下参数：

```python
FRAME_INTERVAL_MS = 500  # 发送帧率: 2fps
VIDEO_RESOLUTION = '480p'  # 视频分辨率
```

- **帧率**: 默认 2fps，降低可节省带宽，提高响应速度
- **分辨率**: 默认 480p (640x480)，更高分辨率会增加处理时间

### 图像压缩

服务会自动：
- 将视频帧调整到最大 720p
- 使用 JPEG 压缩（质量 70）
- 确保每帧不超过 500KB

## 故障排查

### 1. 服务无法启动

**错误:** `ModuleNotFoundError: No module named 'dashscope'`

**解决:**
```bash
pip install dashscope
```

### 2. 摄像头访问被拒绝

**错误:** "摄像头或麦克风权限被拒绝"

**解决:**
- 检查浏览器权限设置
- 确保使用 HTTPS 或 localhost
- 允许浏览器访问摄像头

### 3. Iriun Webcam 错误

**错误:** "Please start Iriun Webcam"

**解决方案:**
- 启动 Iriun Webcam 应用（手机和电脑端）
- 或者从摄像头下拉菜单中选择其他物理摄像头

### 4. 视频分析失败

**错误:** "Qwen Video service error"

**检查:**
1. Qwen Video 服务是否正在运行（`http://localhost:5002/health`）
2. DASHSCOPE_API_KEY 是否正确配置
3. 查看服务端日志获取详细错误信息

### 5. 视频太大无法发送

**解决:**
- 缩短录制时间
- 服务会自动压缩视频帧
- 检查网络连接

## 部署到远程服务器

### 服务器端配置

1. **在服务器上启动 Qwen Video 服务:**

```bash
# 设置监听所有网络接口
python qwen_video_server.py
# 服务会在 0.0.0.0:5002 启动
```

2. **配置防火墙:**

```bash
# 开放 5002 端口
sudo ufw allow 5002
```

3. **使用反向代理（推荐）:**

Nginx 配置示例:
```nginx
location /qwen-video/ {
    proxy_pass http://localhost:5002/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### 前端配置

在 `.env.local` 中设置远程服务地址：

```bash
QWEN_VIDEO_SERVICE_URL=http://192.168.1.100:5002
# 或使用域名
QWEN_VIDEO_SERVICE_URL=https://your-domain.com/qwen-video
```

## 安全建议

1. **生产环境配置:**
   - 使用环境变量管理 API Key，不要硬编码
   - 启用 HTTPS
   - 添加身份验证和授权
   - 限制请求频率（Rate Limiting）

2. **API Key 保护:**
```bash
export DASHSCOPE_API_KEY=sk-your-real-api-key
```

3. **CORS 配置:**
   在生产环境中限制允许的来源：
```python
CORS(app, origins=['https://your-frontend-domain.com'])
```

## 进阶功能

### 自定义系统提示词

```typescript
const formData = new FormData()
formData.append('video', videoBlob)
formData.append('question', '请详细分析视频中的人物动作')

// 会传递给 Qwen-Omni 作为上下文
```

### 实时流式分析

使用会话 API 可以实现实时流式分析：

1. 创建会话
2. 持续发送视频帧（2fps）
3. 通过 Server-Sent Events (SSE) 接收实时响应
4. 分析完成后关闭会话

## 技术栈

- **前端:** Next.js 14, TypeScript, React
- **后端:** Python 3.8+, Flask, OpenCV
- **AI 模型:** Qwen3-Omni-Flash-Realtime (Dashscope)
- **通信:** REST API, Server-Sent Events (SSE)

## 相关文档

- [Qwen-Omni 官方文档](https://help.aliyun.com/zh/model-studio/developer-reference/qwen-omni-api)
- [Dashscope API 文档](https://help.aliyun.com/zh/dashscope/)
- [YAYA 语音服务文档](./VOICE_CHAT_IMPLEMENTATION.md)

## 支持

如有问题，请查看：
- 服务端日志: `qwen_video_server.py` 输出
- 浏览器控制台: F12 查看前端错误
- 网络请求: F12 → Network 标签查看 API 调用

---

更新日期: 2025-01-08
版本: 1.0.0
