# 视频服务模式说明

本项目提供两种视频服务模式，根据您的需求选择使用。

## 📋 模式对比

| 特性 | 简化测试版 | 完整版 |
|------|----------|--------|
| **文件** | `qwen_video_server_simple.py` | `qwen_video_server.py` |
| **依赖** | Flask, OpenCV | 简化版 + Dashscope SDK |
| **AI 分析** | ❌ 返回模拟结果 | ✅ 真实 Qwen-Omni 分析 |
| **网络要求** | 无需外网 | 需要访问阿里云 |
| **API Key** | 不需要 | 需要有效的 Dashscope API Key |
| **用途** | 测试视频处理流程 | 生产环境使用 |

---

## 🔧 模式 1: 简化测试版（当前使用）

### 何时使用
- ✅ 测试视频录制和上传功能
- ✅ 验证前后端集成
- ✅ 调试视频处理逻辑
- ✅ 演示界面功能
- ✅ 离线开发环境

### 启动方法

**Windows:**
```bash
python qwen_video_server_simple.py
# 或
start_qwen_video_simple.bat
```

**Linux/Mac:**
```bash
python3 qwen_video_server_simple.py
```

### 返回结果示例
```json
{
  "analysis": "[模拟结果] 这是一个测试视频。问题: 请分析这个视频中的内容",
  "frame_processed": true,
  "frame_size": 14500,
  "transcript": ""
}
```

### 优点
- ✅ 快速启动，无需配置
- ✅ 不消耗 API 配额
- ✅ 可以离线使用
- ✅ 适合开发调试

### 缺点
- ❌ 只返回模拟结果
- ❌ 无法获得真实的 AI 分析

---

## 🚀 模式 2: 完整版（Qwen-Omni）

### 何时使用
- ✅ 生产环境部署
- ✅ 需要真实的 AI 视频分析
- ✅ 演示完整功能
- ✅ 正式使用场景

### 前置要求

1. **有效的 Dashscope API Key**
   - 访问 https://dashscope.console.aliyun.com/
   - 创建或获取 API Key
   - 确保有足够的配额

2. **网络连接**
   - 能够访问阿里云服务
   - 如果在国外，可能需要配置代理

3. **Python 包**
   ```bash
   pip install dashscope
   ```

### 测试连接

**在启动完整版服务前，先测试连接：**

```bash
python test_dashscope_connection.py
```

**预期输出：**
```
✅ dashscope 导入成功
✅ Qwen-Omni 模块导入成功
✅ 回调类创建成功
✅ 对话实例创建成功
✅ 连接成功
✅ 会话配置成功
✅ 所有测试通过！
```

### 配置 API Key

**方法 1: 环境变量（推荐）**
```bash
# Windows
set DASHSCOPE_API_KEY=sk-your-api-key-here

# Linux/Mac
export DASHSCOPE_API_KEY=sk-your-api-key-here
```

**方法 2: 修改代码**
```python
# 在 qwen_video_server.py 第 16 行
dashscope.api_key = "sk-your-api-key-here"
```

### 启动方法

**Windows:**
```bash
python qwen_video_server.py
# 或
start_qwen_video.bat
```

**Linux/Mac:**
```bash
python3 qwen_video_server.py
# 或
./start_qwen_video.sh
```

### 返回结果示例
```json
{
  "analysis": "视频中显示了一个人在办公室工作，背景是白色墙壁，桌上有电脑显示器...",
  "transcript": "你好，这是语音转录的文字内容..."
}
```

### 优点
- ✅ 真实的 AI 视频理解
- ✅ 支持音频转录
- ✅ 支持实时流式响应
- ✅ 生产级质量

### 缺点
- ❌ 需要有效的 API Key
- ❌ 需要网络连接
- ❌ 消耗 API 配额
- ❌ 可能有延迟

---

## 🔄 模式切换

### 从简化版切换到完整版

1. **测试连接**
   ```bash
   python test_dashscope_connection.py
   ```

2. **如果测试通过，停止简化版服务**
   - 按 `Ctrl+C` 停止 `qwen_video_server_simple.py`

3. **启动完整版服务**
   ```bash
   python qwen_video_server.py
   ```

4. **前端无需修改**
   - 两个版本使用相同的 API 接口
   - 前端代码完全兼容

### 从完整版切换回简化版

1. **停止完整版服务**
   - 按 `Ctrl+C`

2. **启动简化版服务**
   ```bash
   python qwen_video_server_simple.py
   ```

---

## 🐛 故障排查

### 完整版连接失败

**症状：**
```
❌ 连接失败: XXX
会话创建失败
```

**诊断：**
```bash
python test_dashscope_connection.py
```

**常见问题：**

1. **API Key 无效**
   ```
   解决: 访问阿里云控制台，检查或重新生成 API Key
   ```

2. **网络无法访问阿里云**
   ```
   解决: 检查网络连接，配置代理（如需要）
   ```

3. **配额用完**
   ```
   解决: 访问控制台查看配额，购买或等待重置
   ```

4. **模型名称错误**
   ```
   解决: 确认模型名称为 'qwen3-omni-flash-realtime'
   ```

### 简化版问题

**症状：**
```
视频处理失败
```

**检查：**
1. OpenCV 是否正确安装
   ```bash
   pip install opencv-python
   ```

2. 视频格式是否支持
   - 支持: WebM, MP4, JPEG, PNG
   - 不支持: 某些特殊编码的视频

---

## 📊 性能对比

| 指标 | 简化测试版 | 完整版 |
|------|----------|--------|
| 启动时间 | < 1 秒 | 2-3 秒 |
| 响应时间 | < 100ms | 1-5 秒 |
| 准确度 | N/A（模拟） | 高 |
| 资源占用 | 低 | 中 |

---

## 💡 建议的使用流程

### 开发阶段
1. 使用**简化版**进行功能开发
2. 测试视频录制、上传、UI 交互
3. 验证整体流程

### 测试阶段
1. 运行 `test_dashscope_connection.py`
2. 切换到**完整版**
3. 测试真实 AI 分析结果
4. 验证业务逻辑

### 部署阶段
1. 配置生产环境的 API Key
2. 使用**完整版**服务
3. 监控 API 使用量和性能

---

## 📚 相关文档

- [视频对话功能设置指南](./VIDEO_CHAT_SETUP.md)
- [Qwen-Omni 官方文档](https://help.aliyun.com/zh/model-studio/developer-reference/qwen-omni-api)
- [Dashscope 控制台](https://dashscope.console.aliyun.com/)

---

更新日期: 2025-01-08
版本: 1.0.0
