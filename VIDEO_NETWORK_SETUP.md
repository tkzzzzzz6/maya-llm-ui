# 视频服务网络配置指南

## 问题描述

只有主机能连接视频服务，手机和其他设备无法访问。

## 原因分析

1. **前端硬编码地址** ✅ 已修复
   - 之前使用 `ws://localhost:5003`
   - 现在自动使用当前主机的 IP 地址

2. **防火墙阻止端口** ⚠️ 需要配置
3. **网络配置问题** ⚠️ 需要检查

---

## 解决方案

### 1. 前端代码修复 ✅

已更新 `components/chat/chat-hooks/use-video-realtime.tsx`：

```typescript
// 自动使用当前页面的主机名
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
const hostname = window.location.hostname
wsUrl = `${protocol}//${hostname}:5003/ws/video`
```

**工作原理：**
- 从浏览器访问 `http://192.168.1.100:3000` → WebSocket 使用 `ws://192.168.1.100:5003`
- 从手机访问 `http://192.168.1.100:3000` → WebSocket 也使用 `ws://192.168.1.100:5003`

---

### 2. Windows 防火墙配置 ⚠️

#### 方法 A: 通过 PowerShell（推荐）

以**管理员身份**运行 PowerShell，执行：

```powershell
# 允许端口 5003 入站连接
New-NetFirewallRule -DisplayName "Qwen Video Service" -Direction Inbound -LocalPort 5003 -Protocol TCP -Action Allow

# 允许端口 3000 入站连接（Next.js 开发服务器）
New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

#### 方法 B: 通过图形界面

1. 打开 **Windows Defender 防火墙**
2. 点击 **高级设置**
3. 选择 **入站规则** → **新建规则**
4. 选择 **端口** → **下一步**
5. 选择 **TCP**，输入端口 `5003` 和 `3000`
6. 选择 **允许连接**
7. 勾选所有配置文件（域、专用、公用）
8. 命名规则，例如 "Qwen Video Service"

#### 验证防火墙规则

```powershell
# 查看防火墙规则
Get-NetFirewallRule -DisplayName "Qwen Video Service" | Format-Table
Get-NetFirewallRule -DisplayName "Next.js Dev Server" | Format-Table
```

---

### 3. 获取主机 IP 地址

#### Windows:

```cmd
ipconfig
```

查找 **IPv4 地址**，例如：`192.168.1.100`

#### Linux/Mac:

```bash
ip addr show  # Linux
ifconfig      # Mac
```

---

### 4. 测试连接

#### 从其他设备测试

1. **获取主机 IP**：例如 `192.168.1.100`

2. **测试 HTTP 服务**（Next.js）：
   ```
   手机/其他电脑浏览器打开：
   http://192.168.1.100:3000
   ```

3. **测试 WebSocket 服务**（Qwen Video）：
   ```
   打开测试页面：
   http://192.168.1.100:3000/test-websocket.html
   ```

#### 命令行测试

**测试端口是否开放：**

```bash
# Windows (PowerShell)
Test-NetConnection -ComputerName 192.168.1.100 -Port 5003

# Linux/Mac
nc -zv 192.168.1.100 5003
telnet 192.168.1.100 5003
```

**使用 curl 测试 HTTP：**

```bash
curl http://192.168.1.100:5003/health
```

---

### 5. 环境变量配置（可选）

如果需要固定服务器地址，在 `.env.local` 中添加：

```env
# 视频服务 WebSocket 地址
NEXT_PUBLIC_QWEN_VIDEO_WS_URL=ws://192.168.1.100:5003/ws/video

# 或者使用域名
NEXT_PUBLIC_QWEN_VIDEO_WS_URL=ws://your-server.com:5003/ws/video
```

**优先级：**
1. 环境变量 `NEXT_PUBLIC_QWEN_VIDEO_WS_URL`（如果设置）
2. 自动使用当前主机名（默认）

---

### 6. 启动服务

确保两个服务都在运行：

```bash
# 1. 启动 Qwen Video 服务
python qwen_video_server_realtime.py

# 2. 启动 Next.js（新终端）
npm run chat
```

**验证服务运行：**
```bash
# 查看 Qwen Video 服务
http://localhost:5003/health

# 查看 Next.js
http://localhost:3000
```

---

### 7. 常见问题排查

#### ❌ 连接被拒绝（Connection Refused）

**原因：**
- 服务未启动
- 端口号错误

**解决：**
```bash
# 检查端口占用
netstat -ano | findstr :5003
netstat -ano | findstr :3000
```

#### ❌ 连接超时（Connection Timeout）

**原因：**
- 防火墙阻止
- 网络不通

**解决：**
1. 添加防火墙规则（见上方）
2. 确保设备在同一局域网
3. 禁用 Windows Defender 防火墙测试（不推荐生产环境）

#### ❌ 403 Forbidden / CORS 错误

**原因：**
- CORS 配置问题

**解决：**
服务器代码已配置 `CORS(app)`，应该不会有问题。如果还有 CORS 错误，检查：
```python
# qwen_video_server_realtime.py
CORS(app, resources={r"/*": {"origins": "*"}})
```

#### ❌ 手机无法访问

**检查清单：**
1. ✅ 手机和电脑在同一 WiFi 网络
2. ✅ 防火墙已开放端口
3. ✅ 使用主机的局域网 IP（不是 localhost）
4. ✅ 端口号正确（3000 和 5003）

---

### 8. 网络拓扑

```
┌─────────────────────────────────────────────┐
│           局域网 (192.168.1.0/24)            │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │  主机电脑    │      │   手机/其他设备  │ │
│  │              │      │                 │ │
│  │ Next.js      │◄────►│   浏览器        │ │
│  │ :3000        │ HTTP │                 │ │
│  │              │      │                 │ │
│  │ Qwen Video   │◄────►│   WebSocket     │ │
│  │ :5003        │ WS   │                 │ │
│  └──────────────┘      └─────────────────┘ │
│  192.168.1.100         192.168.1.105       │
└─────────────────────────────────────────────┘
```

---

### 9. 安全建议

⚠️ **生产环境注意事项：**

1. **不要使用 0.0.0.0 在公网** - 仅限局域网
2. **添加身份验证** - WebSocket 连接应该验证用户
3. **使用 HTTPS/WSS** - 加密传输
4. **限制 CORS 来源** - 不要使用 `origins: "*"`
5. **添加速率限制** - 防止滥用

---

## 快速验证脚本

保存为 `test-network.ps1` (Windows PowerShell):

```powershell
# 测试网络连接脚本
Write-Host "🔍 检查网络配置..." -ForegroundColor Cyan

# 1. 获取本机 IP
Write-Host "`n1️⃣ 本机 IP 地址:" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"} | Format-Table IPAddress, InterfaceAlias

# 2. 检查端口占用
Write-Host "`n2️⃣ 检查端口占用:" -ForegroundColor Yellow
Write-Host "端口 3000 (Next.js):"
netstat -ano | findstr :3000
Write-Host "端口 5003 (Qwen Video):"
netstat -ano | findstr :5003

# 3. 检查防火墙规则
Write-Host "`n3️⃣ 检查防火墙规则:" -ForegroundColor Yellow
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Qwen*" -or $_.DisplayName -like "*Next*"} | Format-Table DisplayName, Enabled, Direction

Write-Host "`n✅ 检查完成！" -ForegroundColor Green
```

---

## 总结

✅ **已修复的问题：**
- 前端代码自动使用正确的主机地址
- 支持环境变量配置

⚠️ **需要手动操作：**
1. 配置 Windows 防火墙（允许端口 5003 和 3000）
2. 确保设备在同一局域网
3. 使用主机的 IP 地址访问（不是 localhost）

🎯 **测试步骤：**
1. 运行防火墙配置命令
2. 重启两个服务
3. 从手机访问 `http://<主机IP>:3000`
4. 测试视频聊天功能

---

如有问题，请查看：
- 浏览器控制台 (F12)
- 服务器日志
- Windows 事件查看器（防火墙日志）

