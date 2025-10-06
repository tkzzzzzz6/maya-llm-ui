# 🎙️ Google Cloud 语音集成指南

## 概述

本项目已集成 Google Cloud 语音服务，支持语音转文字 (Speech-to-Text) 和文字转语音 (Text-to-Speech)。

## 功能特性

### 语音转文字 (Speech-to-Text)
- **模型**: 使用 Google Cloud 最新长语音模型 (`latest_long`)
- **语言支持**: 支持 100+ 语言（默认 zh-CN）
- **增强功能**: 自动标点、增强识别
- **音频格式**: WEBM_OPUS

### 文字转语音 (Text-to-Speech)
- **语音引擎**: Neural2 和 WaveNet 语音
- **默认语音**: zh-CN-Neural2-D（中文女声）
- **可调参数**: 语速、音调、音量
- **音频格式**: MP3

## 配置指南

### 方式一：使用 API Key（推荐用于开发）

1. **获取 API Key**:
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 创建项目并启用以下 API：
     - Cloud Speech-to-Text API
     - Cloud Text-to-Speech API
   - 创建 API 凭据（API Key）

2. **配置环境变量**:
   ```bash
   # 在 .env.local 中添加
   GOOGLE_API_KEY=your_api_key_here
   ```

### 方式二：使用服务账号（推荐用于生产）

1. **创建服务账号**:
   - 在 Google Cloud Console 中创建服务账号
   - 授予权限：
     - Cloud Speech-to-Text API User
     - Cloud Text-to-Speech API User
   - 下载 JSON 密钥文件

2. **配置环境变量**:
   ```bash
   # 在 .env.local 中添加
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```

## API 端点

### Speech-to-Text
- **路径**: `/api/voice/google/speech-to-text`
- **方法**: POST
- **输入**: FormData
  - `audio`: 音频文件 (File)
  - `language`: 语言代码 (可选，默认 "zh-CN")
- **输出**: JSON
  ```json
  {
    "text": "转录文本",
    "confidence": 0.95
  }
  ```

### Text-to-Speech
- **路径**: `/api/voice/google/text-to-speech`
- **方法**: POST
- **输入**: JSON
  ```json
  {
    "text": "要转换的文本",
    "languageCode": "zh-CN",
    "voiceName": "zh-CN-Neural2-D",
    "speakingRate": 1.0,
    "pitch": 0.0,
    "volumeGainDb": 0.0
  }
  ```
- **输出**: audio/mpeg (MP3 音频流)

## 使用方法

### 在语音聊天界面中使用

1. 打开语音聊天页面
2. 在界面顶部的"语音服务"下拉菜单中选择 "Google Cloud"
3. 点击麦克风按钮开始录音
4. 系统会自动使用 Google Cloud 进行语音识别和语音合成

### 代码示例

```typescript
import { useVoiceHandler } from "@/components/chat/chat-hooks/use-voice-handler"

// 初始化语音处理器，指定使用 Google
const voiceHandler = useVoiceHandler({
  provider: "google",
  onTranscriptionComplete: (text) => {
    console.log("转录结果:", text)
  }
})

// 或动态切换提供商
voiceHandler.setProvider("google")

// TTS 使用示例（Google 特定选项）
await voiceHandler.playTextToSpeech("你好，世界", {
  languageCode: "zh-CN",
  voiceName: "zh-CN-Neural2-D",
  speakingRate: 1.2,
  pitch: 2.0
})
```

## 可用的 Google 语音

### 中文语音 (zh-CN)
- `zh-CN-Neural2-A`: 男声
- `zh-CN-Neural2-B`: 男声
- `zh-CN-Neural2-C`: 女声
- `zh-CN-Neural2-D`: 女声（默认）
- `zh-CN-Wavenet-A`: 女声 (WaveNet)
- `zh-CN-Wavenet-B`: 男声 (WaveNet)
- `zh-CN-Wavenet-C`: 男声 (WaveNet)
- `zh-CN-Wavenet-D`: 女声 (WaveNet)

### 英文语音 (en-US)
- `en-US-Neural2-A` ~ `en-US-Neural2-J`: 多种男女声
- `en-US-Wavenet-A` ~ `en-US-Wavenet-J`: WaveNet 系列

完整语音列表请参考: [Google Cloud TTS Voices](https://cloud.google.com/text-to-speech/docs/voices)

## 语音参数说明

### speakingRate（语速）
- 范围: 0.25 ~ 4.0
- 默认: 1.0
- 示例: 1.5 表示 1.5 倍速

### pitch（音调）
- 范围: -20.0 ~ 20.0
- 默认: 0.0
- 正值: 音调升高
- 负值: 音调降低

### volumeGainDb（音量增益）
- 范围: -96.0 ~ 16.0 dB
- 默认: 0.0
- 正值: 音量增大
- 负值: 音量减小

## 成本估算

### Speech-to-Text 定价
- 标准模型: $0.006/15秒
- 增强模型: $0.009/15秒
- 每月前 60 分钟免费

### Text-to-Speech 定价
- Standard 语音: $4.00/百万字符
- WaveNet 语音: $16.00/百万字符
- Neural2 语音: $16.00/百万字符
- 每月前 100 万字符免费

详细价格: [Google Cloud 定价](https://cloud.google.com/speech-to-text/pricing)

## 技术架构

```
用户界面 (voice-input.tsx)
    ↓
语音处理 Hook (use-voice-handler.tsx)
    ↓ (provider="google")
    ├─→ STT API (/api/voice/google/speech-to-text/route.ts)
    │      ↓
    │   Google Speech SDK (@google-cloud/speech)
    │
    └─→ TTS API (/api/voice/google/text-to-speech/route.ts)
           ↓
        Google TTS SDK (@google-cloud/text-to-speech)
```

## 与 OpenAI 语音的对比

| 特性 | Google Cloud | OpenAI |
|------|-------------|--------|
| STT 语言支持 | 100+ 语言 | 50+ 语言 |
| STT 模型 | Chirp, latest_long | Whisper-1 |
| TTS 语音质量 | Neural2, WaveNet | HD, Standard |
| TTS 语音数量 | 400+ 语音 | 6 个语音 |
| 自定义参数 | 语速、音调、音量 | 语速、语音选择 |
| 定价 | 按秒计费 | 按分钟计费 |
| 免费额度 | 每月 60 分钟 STT | 无免费额度 |

## 故障排查

### 问题：API 返回 "credentials not configured"
**解决方案**: 确保已正确设置 `GOOGLE_API_KEY` 或 `GOOGLE_APPLICATION_CREDENTIALS`

### 问题：STT 识别不准确
**解决方案**:
- 检查 `language` 参数是否正确
- 尝试使用增强模型
- 确保音频质量良好

### 问题：TTS 播放无声音
**解决方案**:
- 检查 `voiceName` 是否与 `languageCode` 匹配
- 确认音频格式兼容性
- 查看浏览器控制台错误日志

## 相关文档

- [Google Cloud Speech-to-Text 文档](https://cloud.google.com/speech-to-text/docs)
- [Google Cloud Text-to-Speech 文档](https://cloud.google.com/text-to-speech/docs)
- [Node.js Client Library](https://cloud.google.com/nodejs/docs/reference/speech/latest)
- [语音聊天功能实现](./VOICE_CHAT_IMPLEMENTATION.md)

## 更新日志

### 2025-10-06
- ✅ 添加 Google Cloud Speech-to-Text API 支持
- ✅ 添加 Google Cloud Text-to-Speech API 支持
- ✅ 实现提供商切换功能
- ✅ 更新 UI 组件支持多提供商选择
- ✅ 添加环境变量配置示例

---

**维护者**: Chatbot UI Team
**最后更新**: 2025-10-06
