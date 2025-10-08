# 视频和语音服务端修复指南

## 问题说明

服务端报错：`ERROR: local variable 'json' referenced before assignment`

**原因**：Python 文件中有多处 `import json`，导致局部变量冲突。

---

## 解决方案

### 方法 1：手动复制修复后的文件（推荐）

**步骤：**

1. **在本机（WSL/前端服务器）找到修复后的文件：**
   ```
   Windows 路径: D:\develop\llm\chatbot-ui\qwen_video_server_realtime.py
   ```

2. **复制到服务器：**
   - 使用 U 盘、共享文件夹或网络复制
   - 或者在服务器上重新下载这个文件

3. **覆盖服务器上的旧文件：**
   ```
   服务器路径: E:\code\LLM\maya-llm\vedio_chat_server\qwen_vedio_realtime.py
   ```

4. **重启服务器：**
   ```powershell
   # 停止当前服务（Ctrl+C）
   # 重新启动
   python qwen_vedio_realtime.py
   ```

---

### 方法 2：手动修改服务器上的文件

**在服务器上，编辑 `qwen_vedio_realtime.py`：**

#### 修改 1：在文件顶部（约第 6-18 行）添加 `import json`

**查找这段代码：**
```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sock import Sock
import os
import base64
import logging
import threading
import queue
import time
import cv2
import numpy as np
from dashscope.audio.qwen_omni import *
import dashscope
```

**修改为（在 `import os` 后添加 `import json`）：**
```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sock import Sock
import os
import json          # ← 添加这一行
import base64
import logging
import threading
import queue
import time
import cv2
import numpy as np
from dashscope.audio.qwen_omni import *
import dashscope
```

---

#### 修改 2：删除函数内的 `import json`（约第 158 行）

**查找这段代码：**
```python
    def _send_to_client(self, data):
        """发送数据到客户端"""
        try:
            import json    # ← 删除这一行
            self.websocket.send(json.dumps(data))
        except Exception as e:
            logger.error(f"发送到客户端失败: {e}")
```

**修改为：**
```python
    def _send_to_client(self, data):
        """发送数据到客户端"""
        try:
            self.websocket.send(json.dumps(data))
        except Exception as e:
            logger.error(f"发送到客户端失败: {e}")
```

---

#### 修改 3：删除消息处理中的 `import json`（约第 300-302 行）

**查找这段代码：**
```python
            try:
                import json    # ← 删除这一行
                data = json.loads(message)
                msg_type = data.get('type')
```

**修改为：**
```python
            try:
                data = json.loads(message)
                msg_type = data.get('type')
```

---

#### 保存并重启

```powershell
# 1. 保存文件
# 2. 停止当前服务（Ctrl+C）
# 3. 重新启动
python qwen_vedio_realtime.py
```

---

## 测试

重启后测试连接，应该看到：

```
INFO:__main__:新的 WebSocket 连接: ws_xxxxx
INFO:__main__:启动实时会话: ws_xxxxx
INFO:websocket:Websocket connected
INFO:__main__:会话创建: sess_xxxxx
INFO:__main__:会话 ws_xxxxx 连接已建立
INFO:__main__:实时会话 ws_xxxxx 启动成功
# 👆 到这里不应该有 ERROR
# 开始传输视频后应该看到处理日志
```

**不应该再看到：**
```
ERROR:__main__:WebSocket 错误: local variable 'json' referenced before assignment
```

---

## 语音服务端问题

如果语音服务也没有数据传输，请检查：

1. **前端是否正确连接到语音服务？**
   - 检查浏览器控制台是否有错误
   - 检查网络请求是否发送到 `http://192.168.243.171:5001`

2. **语音服务是否正常运行？**
   ```powershell
   # 检查服务端日志
   # 应该看到类似的连接信息
   ```

3. **防火墙是否阻止？**
   ```powershell
   # 测试端口是否可访问
   # 在本机执行：
   curl http://192.168.243.171:5001/health
   ```

---

## 快速验证修复

**在修复后的文件中搜索 `import json`：**
- ✅ 应该**只出现 1 次**（在文件顶部，约第 10 行）
- ❌ 不应该在函数内部出现

**Windows 搜索命令：**
```powershell
# 在 PowerShell 中
Select-String -Path "qwen_vedio_realtime.py" -Pattern "import json"
```

应该只显示一行结果（第 10 行左右）。

---

## 常见问题

### Q: 我修改了文件但还是报错？
A: 确保：
1. 停止了旧的服务进程（Ctrl+C）
2. 保存了文件
3. 重新启动服务

### Q: 如何确认文件已更新？
A: 检查文件修改时间，或者在文件顶部添加一行注释验证：
```python
# 修复版本 - 2025-10-08
```

### Q: 语音服务也需要同样修复吗？
A: 如果语音服务也用了类似的 WebSocket 代码，可能需要同样的修复。提供语音服务的文件名，我可以帮你检查。
