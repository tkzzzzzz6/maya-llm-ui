# 🎤 语音聊天功能实现任务清单

## 📝 项目概述
在现有的 Chatbot UI 项目中添加类似 ChatGPT 的语音聊天功能，支持语音输入和语音输出。

## 🎯 核心功能
- ✅ 语音录制 (Web Audio API)
- ✅ 语音转文字 (OpenAI Whisper)
- ✅ 文字转语音 (OpenAI TTS)
- ✅ 实时波形可视化
- ✅ 与现有聊天系统集成

---

## 📋 任务清单

### 阶段 1: 基础设施层 (API Routes)
#### ✅ 任务 1.1: 创建 STT API 路由
- **文件**: `app/api/voice/speech-to-text/route.ts`
- **功能**: 接收音频文件，调用 OpenAI Whisper API 转文字
- **输入**: FormData (audio file)
- **输出**: { text: string }
- **优先级**: 🔥 高 (推荐首先实现)

#### ✅ 任务 1.2: 创建 TTS API 路由
- **文件**: `app/api/voice/text-to-speech/route.ts`
- **功能**: 接收文字，调用 OpenAI TTS API 生成音频
- **输入**: { text: string, voice?: string }
- **输出**: Audio stream (audio/mpeg)
- **优先级**: 🔥 高

---

### 阶段 2: 核心 Hook 层
#### ✅ 任务 2.1: 创建语音处理 Hook
- **文件**: `components/chat/chat-hooks/use-voice-handler.tsx`
- **功能**:
  - 管理录音状态 (isRecording, isPaused)
  - 控制 MediaRecorder API
  - 处理音频 Blob
  - 调用 STT API
  - 调用 TTS API 并播放
- **依赖**: MediaRecorder API, Web Audio API
- **优先级**: 🔥 高

---

### 阶段 3: UI 组件层
#### ✅ 任务 3.1: 创建语音可视化组件
- **文件**: `components/chat/voice-visualizer.tsx`
- **功能**:
  - Canvas 绘制实时波形
  - 使用 Web Audio API AnalyserNode
  - 支持录音和播放两种模式
- **优先级**: 🟡 中

#### ✅ 任务 3.2: 创建语音输入控制组件
- **文件**: `components/chat/voice-input.tsx`
- **功能**:
  - 🎤 录音按钮 (开始/停止)
  - ⏸️ 暂停/继续按钮
  - 🔊 播放控制
  - 录音时长显示
  - 状态指示器
- **优先级**: 🔥 高

#### ✅ 任务 3.3: 创建语音聊天主 UI 组件
- **文件**: `components/chat/voice-chat-ui.tsx`
- **功能**:
  - 复用 ChatUI 的消息显示逻辑
  - 集成 VoiceInput 组件
  - 集成 VoiceVisualizer 组件
  - 自动 TTS 播放 AI 回复
- **优先级**: 🟡 中

---

### 阶段 4: 路由和页面层
#### ✅ 任务 4.1: 创建语音聊天页面 (带 chatid)
- **文件**: `app/[locale]/[workspaceid]/voice-chat/[chatid]/page.tsx`
- **功能**: 渲染 VoiceChatUI 组件
- **优先级**: 🟡 中

#### ✅ 任务 4.2: 创建语音聊天页面 (无 chatid)
- **文件**: `app/[locale]/[workspaceid]/voice-chat/page.tsx`
- **功能**: 初始化新的语音聊天会话
- **优先级**: 🟢 低

---

### 阶段 5: 集成现有系统
#### ✅ 任务 5.1: 修改聊天辅助按钮
- **文件**: `components/chat/chat-secondary-buttons.tsx`
- **修改**: 添加麦克风图标按钮，点击跳转到语音聊天页面
- **优先级**: 🟡 中

#### ✅ 任务 5.2: 扩展全局上下文
- **文件**: `context/context.tsx`
- **新增状态**:
  - `isRecording: boolean`
  - `isPlayingTTS: boolean`
  - `currentAudioBlob: Blob | null`
  - `transcription: string`
- **优先级**: 🟡 中

---

### 阶段 6: 测试和优化
#### ✅ 任务 6.1: 测试语音录制和转文字
- 测试不同浏览器兼容性 (Chrome, Firefox, Safari)
- 测试不同音频格式
- 测试长时间录音
- **优先级**: 🟢 低

#### ✅ 任务 6.2: 测试文字转语音和播放
- 测试不同 TTS 声音选项
- 测试长文本分段播放
- 测试播放控制 (暂停/继续/停止)
- **优先级**: 🟢 低

#### ✅ 任务 6.3: 性能优化
- 音频流式处理
- 减少 API 调用延迟
- 优化波形渲染性能
- **优先级**: 🟢 低

---

## 🛠️ 技术栈

### 前端
- **录音**: `MediaRecorder API`
- **音频处理**: `Web Audio API`
- **可视化**: `Canvas API`
- **状态管理**: React Context + useState

### 后端 API
- **STT**: OpenAI Whisper API (`whisper-1`)
- **TTS**: OpenAI TTS API (`tts-1` / `tts-1-hd`)
- **音频格式**: WebM (录制), MP3 (播放)

---

## 🔧 环境变量

需要在 `.env.local` 中配置:

```bash
# OpenAI API Key (用于 Whisper 和 TTS)
OPENAI_API_KEY=sk-xxxxxxxxx

# 可选: TTS 默认配置
NEXT_PUBLIC_TTS_VOICE=alloy  # 可选: alloy, echo, fable, onyx, nova, shimmer
NEXT_PUBLIC_TTS_MODEL=tts-1  # 可选: tts-1, tts-1-hd
```

---

## 📦 依赖包

现有依赖已足够，无需额外安装。使用:
- `next` (App Router)
- `react`
- `@tabler/icons-react` (图标)
- 浏览器原生 API (MediaRecorder, Web Audio)

---

## 🚀 推荐实现顺序

### 第一步: API 层 (最优先)
1. ✅ **STT API** (`app/api/voice/speech-to-text/route.ts`)
2. ✅ **TTS API** (`app/api/voice/text-to-speech/route.ts`)

### 第二步: Hook 层
3. ✅ **语音处理 Hook** (`components/chat/chat-hooks/use-voice-handler.tsx`)

### 第三步: UI 组件
4. ✅ **语音输入控制** (`components/chat/voice-input.tsx`)
5. ⏳ **语音可视化** (`components/chat/voice-visualizer.tsx`)
6. ⏳ **语音聊天 UI** (`components/chat/voice-chat-ui.tsx`)

### 第四步: 页面路由
7. ⏳ **创建页面路由** (`app/.../voice-chat/...`)

### 第五步: 集成
8. ⏳ **添加跳转按钮** (`chat-secondary-buttons.tsx`)
9. ⏳ **扩展上下文** (`context/context.tsx`)

### 第六步: 测试
10. ⏳ **端到端测试**

---

## 📝 注意事项

### 浏览器兼容性
- MediaRecorder API 支持: Chrome 47+, Firefox 25+, Safari 14.1+
- getUserMedia 需要 HTTPS (本地开发使用 localhost)

### 安全性
- 麦克风权限需要用户授权
- 音频数据传输建议加密
- API Key 存储在服务端，不暴露到客户端

### 用户体验
- 录音时显示明显的视觉反馈
- TTS 播放时允许中断
- 提供文字备份显示
- 支持键盘快捷键 (如空格键录音)

---

## 🎨 UI 设计参考

```
┌──────────────────────────────────────┐
│  语音聊天 - Chat Name           [×]  │
├──────────────────────────────────────┤
│                                      │
│  [消息历史显示区域]                  │
│  User: 你好                          │
│  AI: 你好！有什么我可以帮助你的？   │
│                                      │
├──────────────────────────────────────┤
│  [实时波形可视化]                    │
│  ▁▂▃▅▇▆▄▃▂▁▁▂▃▄▅▆▇▆▅▄▃▂▁         │
│                                      │
├──────────────────────────────────────┤
│          [录音时长: 00:05]           │
│                                      │
│     ┌─────────┐  ┌─────────┐        │
│     │   🎤    │  │   ⏹️    │        │
│     │  录音   │  │  停止   │        │
│     └─────────┘  └─────────┘        │
│                                      │
│     [🔊 正在播放回复...]             │
└──────────────────────────────────────┘
```

---

## ✅ 完成标准

- [ ] 能够成功录制语音并转为文字
- [ ] 能够将 AI 回复转为语音并播放
- [ ] 波形可视化正常显示
- [ ] 与现有聊天系统无缝集成
- [ ] 支持主流浏览器
- [ ] 用户体验流畅，无明显卡顿

---

**创建时间**: 2025-10-06
**预计完成时间**: 2-3 天开发时间
