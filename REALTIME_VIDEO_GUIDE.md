# 实时视频分析服务指南

## 🎯 设计思路

参考 `vad_dash.py` 的实时流式架构，实现真正的实时视频+音频分析。

### 为什么需要实时流式？

**问题：**
- ❌ 一次性上传视频 → VAD 无法检测语音结束 → 程序永远等待
- ❌ 禁用 VAD → 失去自动语音检测能力 → 用户体验差

**解决方案：**
- ✅ 实时流式传输 → VAD 实时检测 → 自动触发响应
- ✅ 模仿 `vad_dash.py` → 持续发送音视频 → 完美工作

## 📋 架构对比

| 特性 | 一次性上传版 | 实时流式版 |
|------|------------|----------|
| **文件** | `qwen_video_server.py` | `qwen_video_server_realtime.py` |
| **通信** | HTTP POST | WebSocket |
| **视频** | 单帧 | 2fps 持续流 |
| **音频** | 完整音频 | 实时音频流 |
| **VAD** | 需禁用 | 启用（自动检测） |
| **响应** | 等待超时 | 实时流式 |
| **参考** | - | `vad_dash.py` |

## 🚀 快速开始

### 1. 安装依赖

```bash
# Python 依赖
pip install flask flask-cors flask-sock opencv-python numpy dashscope

# 或使用脚本
chmod +x install_realtime_deps.sh
./install_realtime_deps.sh
```

### 2. 配置环境变量

在 `.env.local` 中添加：

```bash
# WebSocket 地址
NEXT_PUBLIC_QWEN_VIDEO_WS_URL=ws://localhost:5003/ws/video

# Dashscope API Key
DASHSCOPE_API_KEY=sk-your-api-key-here
```

### 3. 启动实时服务

```bash
# Windows
start_qwen_realtime.bat

# Linux/Mac
python qwen_video_server_realtime.py
```

**预期输出：**
```
✅ 服务启动成功！
📍 地址: http://0.0.0.0:5003
📹 视频分析: Qwen3-Omni-Flash-Realtime
🔄 模式: 实时流式处理（WebSocket）
🎤 VAD: 启用（自动检测语音）
```

### 4. 启动前端

```bash
npm run dev
```

### 5. 使用实时视频聊天

1. 打开浏览器
2. 进入视频聊天页面
3. 点击"连接服务"
4. 点击"开始视频流"
5. 开始说话，AI 会自动响应

## 💻 前端使用

### 使用实时组件

```typescript
import { VideoChatRealtimeUI } from "@/components/chat/video-chat-realtime-ui"

<VideoChatRealtimeUI
  onResponse={(text) => {
    console.log("AI 响应:", text)
  }}
/>
```

### 使用 Hook

```typescript
import { useVideoRealtime } from "@/components/chat/chat-hooks/use-video-realtime"

const {
  isConnected,
  isStreaming,
  currentResponse,
  currentTranscript,
  connect,
  disconnect,
  startStreaming,
  stopStreaming
} = useVideoRealtime({
  onResponse: (text) => {
    console.log("收到响应:", text)
  }
})

// 使用
await connect()
await startStreaming()
```

## 📡 WebSocket 协议

### 客户端 → 服务端

**发送视频帧：**
```json
{
  "type": "video",
  "data": "base64_encoded_jpeg"
}
```

**发送音频数据：**
```json
{
  "type": "audio",
  "data": "base64_encoded_pcm"
}
```

**关闭连接：**
```json
{
  "type": "close"
}
```

### 服务端 → 客户端

**会话就绪：**
```json
{
  "type": "ready",
  "session_id": "ws_1234567890",
  "message": "实时视频分析会话已建立"
}
```

**文本响应（增量）：**
```json
{
  "type": "text.delta",
  "text": "视频中..."
}
```

**音频响应（增量）：**
```json
{
  "type": "audio.delta",
  "audio": "base64_encoded_audio"
}
```

**语音转录：**
```json
{
  "type": "transcript",
  "text": "你好，请分析这个视频"
}
```

**语音开始：**
```json
{
  "type": "speech.started"
}
```

**响应完成：**
```json
{
  "type": "response.done"
}
```

## 🔍 工作流程

### 参考 vad_dash.py

```python
# 1. 持续捕获视频帧（2fps）
while True:
    frame = capture_frame()
    conversation.append_video(frame_b64)
    time.sleep(0.5)  # 2fps

# 2. 持续发送音频流（16000Hz）
audio_data = mic_stream.read(800)  # 25ms
conversation.append_audio(audio_b64)

# 3. VAD 自动检测语音
# - 检测到语音开始 → speech_started 事件
# - 检测到语音结束 → 自动触发 AI 响应

# 4. 实时接收响应
# - 文本增量响应
# - 音频增量响应
```

### 我们的实现

```typescript
// 1. 定时发送视频帧（2fps）
setInterval(async () => {
  const bitmap = await imageCapture.grabFrame()
  const base64 = await canvasToBase64(bitmap)
  ws.send(JSON.stringify({
    type: 'video',
    data: base64
  }))
}, 500)

// 2. 实时发送音频（ScriptProcessorNode）
processor.onaudioprocess = (e) => {
  const pcm = audioto16BitPCM(e.inputBuffer)
  const base64 = arrayBufferToBase64(pcm)
  ws.send(JSON.stringify({
    type: 'audio',
    data: base64
  }))
}

// 3. 接收实时响应
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  switch (data.type) {
    case 'text.delta':
      setResponse(prev => prev + data.text)
      break
    case 'transcript':
      setTranscript(data.text)
      break
  }
}
```

## ⚙️ 性能配置

### 视频帧率

```python
# qwen_video_server_realtime.py 第 24 行
FRAME_INTERVAL_MS = 500  # 2fps（与 vad_dash.py 一致）

# 可调整范围:
# - 250ms (4fps): 更流畅，消耗更多带宽
# - 500ms (2fps): 推荐（平衡）
# - 1000ms (1fps): 省带宽，响应慢
```

### 音频处理

```typescript
// 音频块大小
const processor = audioContext.createScriptProcessor(
  4096,  // 缓冲区大小 (256ms @ 16000Hz)
  1,     // 输入通道
  1      // 输出通道
)

// 推荐: 4096 样本（平衡延迟和性能）
```

## 🐛 故障排查

### 问题 1: WebSocket 连接失败

**症状：**
```
Error: WebSocket connection failed
```

**检查：**
1. 服务是否运行：`curl http://localhost:5003/health`
2. 端口是否正确：5003
3. 防火墙是否开放

### 问题 2: 没有视频流

**症状：**
视频预览为黑屏

**解决：**
1. 检查摄像头权限
2. 确认浏览器支持 `ImageCapture` API
3. 查看浏览器控制台错误

### 问题 3: 没有音频

**症状：**
VAD 没有检测到语音

**解决：**
1. 检查麦克风权限
2. 确认音频采样率：16000Hz
3. 查看服务端日志是否收到音频数据

### 问题 4: AI 不响应

**症状：**
说话后没有响应

**检查：**
1. 服务端日志是否显示"检测到语音开始"
2. 音频是否正确编码为 16-bit PCM
3. Dashscope API Key 是否有效
4. 查看 VAD 是否启用：`enable_turn_detection=True`

## 📊 性能监控

### 查看日志

**服务端：**
```bash
# 启动时带详细日志
python qwen_video_server_realtime.py

# 应该看到:
INFO: 收到视频帧
INFO: 收到音频数据
INFO: 检测到语音开始
INFO: 响应完成
```

**客户端（浏览器控制台）：**
```javascript
// 应该看到:
WebSocket 连接成功
收到响应: delta
语音转录: ...
```

### 性能指标

| 指标 | 正常值 |
|------|--------|
| 视频帧发送间隔 | 500ms |
| 音频块大小 | 4096 samples |
| WebSocket 延迟 | < 100ms |
| AI 响应延迟 | 1-3s |
| 语音检测延迟 | < 500ms |

## 🎓 最佳实践

### 1. 网络优化

```python
# 降低视频分辨率
if height > 720:
    frame = cv2.resize(frame, (..., 720))

# 降低 JPEG 质量
encode_param = [cv2.IMWRITE_JPEG_QUALITY, 70]
```

### 2. 错误恢复

```typescript
// WebSocket 自动重连
ws.onerror = () => {
  setTimeout(() => connect(), 3000)
}
```

### 3. 资源清理

```typescript
// 组件卸载时清理
useEffect(() => {
  return () => {
    disconnect()
    stopStreaming()
  }
}, [])
```

## 📚 参考资料

- [vad_dash.py 源码](./qwen.omini/vad_dash.py)
- [Qwen-Omni API 文档](https://help.aliyun.com/zh/model-studio/developer-reference/qwen-omni-api)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [ImageCapture API](https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture)

## 🎯 总结

### 关键优势

1. ✅ **真正的实时**：持续流式传输，VAD 自动检测
2. ✅ **参考成熟方案**：基于 `vad_dash.py` 验证的架构
3. ✅ **用户体验好**：说话即响应，无需手动触发
4. ✅ **功能完整**：视频+音频+文本+语音转录

### 适用场景

- ✅ 实时视频对话
- ✅ 视频内容问答
- ✅ 视频监控分析
- ✅ 视频辅助教学

---

更新时间: 2025-01-08
版本: 2.0.0 (Realtime)
