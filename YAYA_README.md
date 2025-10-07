# YAYA 本地语音服务

基于你的 `15.1_SenceVoice_kws_CAM++.py` 实现的语音服务 API

## 🎯 功能特性

### 语音识别 (STT)
- **完整版**: FunASR SenseVoice (本地)
- **简化版**: Google Speech Recognition (在线)

### 语音合成 (TTS)
- **Edge-TTS**: 高质量的微软语音合成
- 支持多种中英文音色
- 支持语速和音调调节

## 📦 两个版本

### 1. 完整版 (`yaya_voice_server_full.py`)
✅ 完全本地 STT (SenseVoice)
✅ Edge-TTS 语音合成
✅ 自动降级到 Google STT (如果模型加载失败)
⚠️ 需要下载模型 (~200MB)
⚠️ 首次启动较慢

```bash
# 安装依赖
pip install -r yaya_requirements_full.txt

# 启动服务
python yaya_voice_server_full.py
```

### 2. 简化版 (`yaya_voice_server_simple.py`)
✅ Google STT (在线)
✅ Edge-TTS 语音合成
✅ 安装简单、启动快速
⚠️ STT 需要网络连接

```bash
# 安装依赖
pip install -r yaya_requirements_simple.txt

# 启动服务
python yaya_voice_server_simple.py
```

## 🚀 快速开始

### Windows 用户

1. **安装 ffmpeg** (用于音频格式转换)
   ```bash
   # 使用 Chocolatey
   choco install ffmpeg

   # 或使用 Scoop
   scoop install ffmpeg
   ```

2. **设置代理** (如果 Edge-TTS 无法访问)
   ```bash
   set https_proxy=http://192.168.243.93:10808
   set http_proxy=http://192.168.243.93:10808
   ```

3. **使用启动脚本**
   ```bash
   # 双击运行或在命令行执行
   start_yaya.bat
   ```

### Linux/Mac 用户

```bash
# 设置代理
export https_proxy=http://192.168.243.93:10808
export http_proxy=http://192.168.243.93:10808

# 启动服务
chmod +x start_yaya.sh
./start_yaya.sh
```

## 🌐 API 端点

### 健康检查
```
GET http://localhost:5001/health
```

### 语音转文字
```
POST http://localhost:5001/api/speech-to-text
Content-Type: multipart/form-data

audio: <audio file (WebM/WAV)>
```

### 文字转语音
```
POST http://localhost:5001/api/text-to-speech
Content-Type: application/json

{
  "text": "你好，我是YAYA",
  "voice": "zh-CN-XiaoyiNeural",
  "rate": "+0%",
  "pitch": "+0Hz"
}
```

### 获取语音列表
```
GET http://localhost:5001/api/voices
```

## 🎤 可用语音

| Voice ID | 名称 | 语言 |
|----------|------|------|
| zh-CN-XiaoxiaoNeural | 晓晓 (女声) | 中文 |
| zh-CN-XiaoyiNeural | 晓伊 (女声) | 中文 |
| zh-CN-YunxiNeural | 云希 (男声) | 中文 |
| zh-CN-YunyangNeural | 云扬 (男声) | 中文 |
| zh-TW-HsiaoChenNeural | 曉臻 | 台湾中文 |
| zh-HK-HiuGaaiNeural | 曉佳 | 香港中文 |
| en-US-JennyNeural | Jenny | 英语 |
| ja-JP-NanamiNeural | ななみ | 日语 |
| ko-KR-SunHiNeural | 선히 | 韩语 |

## 🔧 配置

### 在 `.env.local` 中配置服务地址
```bash
YAYA_SERVICE_URL=http://192.168.243.171:5001
```

### 设置代理 (如果需要)
```bash
# Windows CMD
set https_proxy=http://192.168.243.93:10808

# Windows PowerShell
$env:https_proxy="http://192.168.243.93:10808"

# Linux/Mac
export https_proxy=http://192.168.243.93:10808
```

## 🐛 故障排除

### 问题: 音频格式转换失败
**解决**: 安装 ffmpeg
```bash
# Windows
choco install ffmpeg

# Mac
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### 问题: Edge-TTS 403 错误
**解决**: 设置代理环境变量
```bash
set https_proxy=http://your-proxy:port
```

### 问题: SenseVoice 模型加载失败
**解决**:
```bash
# 安装缺失依赖
pip install rotary_embedding_torch

# 或使用简化版
python yaya_voice_server_simple.py
```

### 问题: Google STT 无法使用
**解决**:
- 检查网络连接
- 使用完整版 (SenseVoice 不需要网络)

## 📊 性能对比

| 特性 | 完整版 | 简化版 |
|------|--------|--------|
| STT 准确率 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 离线可用 | ✅ | ❌ |
| 启动速度 | 慢 (模型加载) | 快 |
| 内存占用 | ~2GB | ~100MB |
| 安装难度 | 中等 | 简单 |

## 🎨 参考代码

本服务基于以下代码实现:
- `15.1_SenceVoice_kws_CAM++.py` - SenseVoice + Edge-TTS 集成
- FunASR AutoModel - 语音识别
- Edge-TTS - 语音合成

## 📝 更新日志

### v1.0.0
- ✅ 完整版: SenseVoice STT
- ✅ 简化版: Google STT
- ✅ Edge-TTS 支持
- ✅ 音频格式自动转换
- ✅ 代理支持
- ✅ 重试机制

## 📄 许可证

MIT License
