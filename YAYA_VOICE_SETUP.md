# YAYA 本地语音服务设置指南

YAYA 是一个基于 SenseVoice 和 Edge-TTS 的本地语音服务,提供语音识别(STT)和文字转语音(TTS)功能。

## 安装步骤

### 1. 安装 Python 依赖

```bash
pip install -r yaya_requirements.txt
```

### 2. 启动 YAYA 服务

```bash
python yaya_voice_server.py
```

服务将在 `http://localhost:5001` 上运行。

### 3. 配置环境变量

在 `.env.local` 文件中添加:

```bash
YAYA_SERVICE_URL=http://localhost:5001
```

### 4. 使用 YAYA

1. 启动 Next.js 应用: `npm run dev`
2. 在聊天界面点击语音按钮
3. 在语音服务下拉菜单中选择 "YAYA (本地)"
4. 开始录音和语音对话

## 功能特性

### 语音识别 (Speech-to-Text)
- 基于 FunASR 的 SenseVoice 模型
- 支持中文、英文等多语言自动识别
- 高准确率的语音转文字

### 文字转语音 (Text-to-Speech)
- 基于 Microsoft Edge-TTS
- 支持多种中文和英文语音
- 默认使用"晓晓"女声(zh-CN-XiaoxiaoNeural)

## 可用语音列表

| Voice ID | 名称 | 语言 |
|----------|------|------|
| zh-CN-XiaoxiaoNeural | 晓晓 (女声) | 中文 |
| zh-CN-YunxiNeural | 云希 (男声) | 中文 |
| zh-CN-YunyangNeural | 云扬 (男声) | 中文 |
| zh-CN-XiaoyiNeural | 晓伊 (女声) | 中文 |
| en-US-AriaNeural | Aria (Female) | 英文 |
| en-US-GuyNeural | Guy (Male) | 英文 |

## API 端点

### 健康检查
```bash
GET http://localhost:5001/health
```

### 语音转文字
```bash
POST http://localhost:5001/api/speech-to-text
Content-Type: multipart/form-data

audio: <audio file>
```

### 文字转语音
```bash
POST http://localhost:5001/api/text-to-speech
Content-Type: application/json

{
  "text": "你好，我是YAYA",
  "voice": "zh-CN-XiaoxiaoNeural",
  "rate": "+0%",
  "pitch": "+0Hz"
}
```

### 获取可用语音列表
```bash
GET http://localhost:5001/api/voices
```

## 故障排除

### 问题: 无法连接到 YAYA 服务

**解决方案:**
1. 确保 YAYA 服务正在运行: `python yaya_voice_server.py`
2. 检查 `.env.local` 中的 `YAYA_SERVICE_URL` 配置
3. 确认防火墙没有阻止 5001 端口

### 问题: 模型加载失败

**解决方案:**
1. 确保已安装所有依赖: `pip install -r yaya_requirements.txt`
2. 检查网络连接,首次运行需要下载模型
3. 查看控制台日志获取详细错误信息

### 问题: 语音识别不准确

**解决方案:**
1. 确保录音环境安静
2. 说话清晰,语速适中
3. 检查麦克风质量和权限设置

## 优势

✅ **完全本地化** - 无需调用外部 API,数据隐私有保障
✅ **免费使用** - 不需要 API key,无使用限制
✅ **高准确率** - SenseVoice 模型在中文识别上表现优异
✅ **多语言支持** - 自动识别中英文等多种语言
✅ **自然语音** - Edge-TTS 提供高质量的语音合成
✅ **易于集成** - RESTful API 设计,方便扩展

## 技术栈

- **语音识别**: FunASR (SenseVoice)
- **语音合成**: Edge-TTS
- **Web 框架**: Flask
- **语言**: Python 3.8+

## 许可证

本项目遵循 MIT 许可证。
