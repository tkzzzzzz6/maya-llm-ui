# 视频聊天跨设备访问解决方案

## 问题说明

浏览器安全策略要求访问摄像头和麦克风必须在**安全上下文（Secure Context）**中：
- ✅ `localhost` - 永远安全
- ✅ `https://` - HTTPS 安全
- ❌ `http://IP地址` - 不安全，无法访问摄像头

当前状态：
- ✅ 本机 `http://localhost:3000` - 可以访问
- ❌ 服务器 `http://192.168.243.171:3000` - 无法访问摄像头
- ❌ 手机 `http://192.168.243.171:3000` - 无法访问摄像头

---

## 解决方案 1：自签名 HTTPS 证书（推荐，5分钟完成）

### 步骤 1：生成自签名证书

在你的**前端服务器**（本机）上，在项目根目录执行：

```bash
# Windows PowerShell
# 安装 mkcert（如果还没安装）
# 方法1：使用 Chocolatey
choco install mkcert

# 方法2：手动下载
# https://github.com/FiloSottile/mkcert/releases

# 安装本地 CA
mkcert -install

# 生成证书（为所有设备添加证书）
mkcert localhost 127.0.0.1 192.168.243.171 ::1

# 这会生成两个文件：
# localhost+3.pem (证书)
# localhost+3-key.pem (私钥)
```

### 步骤 2：配置 Next.js 使用 HTTPS

创建文件 `server.js`：

```javascript
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // 允许外部访问
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./localhost+3-key.pem'),
  cert: fs.readFileSync('./localhost+3.pem'),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${port}`);
    console.log(`> Also available on https://192.168.243.171:${port}`);
  });
});
```

### 步骤 3：修改 package.json

```json
{
  "scripts": {
    "dev": "node server.js",
    "dev:http": "next dev",
    "build": "next build",
    "start": "NODE_ENV=production node server.js"
  }
}
```

### 步骤 4：更新 .env.local

```env
# 使用 wss:// 而不是 ws://
NEXT_PUBLIC_QWEN_VIDEO_WS_URL=ws://192.168.243.171:5003/ws/video
```

### 步骤 5：在其他设备信任证书

**手机/其他电脑**：
1. 访问 `https://192.168.243.171:3000`
2. 浏览器会显示"不安全"警告
3. 点击"高级" -> "继续访问"（或"接受风险"）
4. 首次访问后，浏览器会记住这个证书

---

## 解决方案 2：使用内网域名（推荐，需要路由器支持）

### 步骤 1：配置路由器 DNS

在路由器管理界面添加 DNS 记录：
```
chatbot.local -> 192.168.243.171
```

### 步骤 2：生成域名证书

```bash
mkcert chatbot.local "*.chatbot.local"
```

### 步骤 3：访问

所有设备使用 `https://chatbot.local:3000`

---

## 解决方案 3：Chrome 临时标志（仅开发测试）

**仅用于开发测试，不安全！**

### Chrome/Edge

1. 地址栏输入：`chrome://flags`
2. 搜索：`Insecure origins treated as secure`
3. 添加：`http://192.168.243.171:3000`
4. 重启浏览器

### Android Chrome

1. 在手机上访问：`chrome://flags`
2. 搜索：`Insecure origins treated as secure`
3. 添加：`http://192.168.243.171:3000`
4. 重启 Chrome

**注意**：这个方法需要在每个设备上单独配置，且不安全。

---

## 解决方案 4：Cloudflare Tunnel（适合远程访问）

如果需要从外网访问，可以使用 Cloudflare Tunnel：

```bash
# 安装 cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation

# 登录
cloudflared tunnel login

# 创建隧道
cloudflared tunnel create chatbot-ui

# 配置路由
cloudflared tunnel route dns chatbot-ui chatbot.yourdomain.com

# 运行
cloudflared tunnel run chatbot-ui
```

配置文件 `~/.cloudflared/config.yml`：
```yaml
tunnel: <tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: chatbot.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## 推荐方案

**对于你的情况（局域网使用）**：

✅ **方案 1（自签名 HTTPS）** - 最简单、最快速
- 5 分钟设置
- 局域网所有设备都能访问
- 需要在每个设备上接受证书（一次性）

---

## 测试步骤

设置完成后：

1. **本机测试**：`https://localhost:3000`
2. **服务器测试**：`https://192.168.243.171:3000`
3. **手机测试**：`https://192.168.243.171:3000`

所有设备都应该能够：
- ✅ 访问页面
- ✅ 连接 WebSocket
- ✅ 访问摄像头和麦克风
- ✅ 进行视频聊天

---

## 常见问题

### Q: 为什么语音聊天可以，视频聊天不行？
A: 语音聊天可能使用的是 Web Audio API，不需要 `getUserMedia`，或者使用了文件上传而不是实时流。视频聊天必须使用 `getUserMedia` API，这个 API 有严格的安全要求。

### Q: 可以用 IP 地址访问吗？
A: 可以，但必须使用 HTTPS。HTTP + IP 地址不是安全上下文。

### Q: 手机上显示"证书无效"怎么办？
A: 点击"高级"，然后选择"继续访问"或"接受风险"。自签名证书会有这个警告，但是安全的（仅限局域网使用）。

### Q: 需要在每个设备上都安装证书吗？
A: 不需要"安装"，只需要首次访问时"接受"证书即可。浏览器会记住。

---

## 快速开始（最简方案）

如果你只是想快速测试，最快的方法：

```bash
# 1. 安装 mkcert
choco install mkcert

# 2. 生成证书
mkcert -install
mkcert localhost 127.0.0.1 192.168.243.171

# 3. 创建 server.js（内容见方案1）

# 4. 启动
npm run dev

# 5. 访问
# 本机: https://localhost:3000
# 其他设备: https://192.168.243.171:3000
```

完成！🎉
