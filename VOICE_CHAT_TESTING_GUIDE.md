# 🎤 语音聊天功能测试指南

## 📋 前置条件检查

### 1. 环境变量配置
确保 `.env.local` 文件中有以下配置:

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxx
```

### 2. 重启开发服务器
修改代码后必须重启服务器:

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
npm run chat
```

或者

```bash
npm run restart
```

---

## 🔍 验证按钮是否显示

### 方法 1: 检查现有聊天
1. 打开浏览器访问: `http://localhost:3000`
2. 登录你的账号
3. **重要**: 必须点击左侧边栏中的一个现有聊天
4. 查看聊天页面右上角是否有三个图标:
   - ℹ️ Info 图标
   - ➕ New Chat 图标
   - **🎤 Microphone 图标** ← 这个就是语音聊天入口

### 方法 2: 创建新聊天
1. 点击左侧边栏的 "New Chat" 或 ➕ 按钮
2. 发送一条消息 (例如: "你好")
3. 等待 AI 回复
4. 查看右上角是否出现 🎤 麦克风图标

---

## ⚠️ 常见问题排查

### 问题 1: 看不到麦克风按钮

**可能原因**:
- ❌ 没有选中任何聊天 (在主页或空白页面)
- ❌ 开发服务器没有重启
- ❌ 浏览器缓存未清除

**解决方法**:
```bash
# 1. 停止当前服务器
Ctrl+C

# 2. 清理缓存并重启
npm run restart

# 3. 在浏览器中硬刷新
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### 问题 2: 点击麦克风按钮后 404

**可能原因**:
- 路由文件没有正确创建

**解决方法**:
检查这些文件是否存在:
```bash
ls -la app/[locale]/[workspaceid]/voice-chat/[chatid]/page.tsx
ls -la app/[locale]/[workspaceid]/voice-chat/page.tsx
```

### 问题 3: TypeScript 编译错误

**检查编译错误**:
```bash
npm run type-check
```

如果有错误,查看输出并修复。

---

## 🧪 完整测试流程

### 步骤 1: 启动服务器
```bash
cd /mnt/d/develop/llm/chatbot-ui
npm run chat
```

等待输出:
```
✓ Ready in XXXms
○ Local:   http://localhost:3000
```

### 步骤 2: 打开浏览器
访问: `http://localhost:3000`

### 步骤 3: 进入聊天页面
1. 登录账号
2. 点击左侧任意一个聊天记录
3. 或者创建新聊天并发送一条消息

### 步骤 4: 查找麦克风按钮
在聊天页面右上角,应该看到:

```
┌─────────────────────────────────┐
│  Chat Name              ℹ️ ➕ 🎤 │  ← 右上角这里
├─────────────────────────────────┤
│                                 │
│  [聊天消息区域]                  │
│                                 │
```

### 步骤 5: 点击麦克风按钮
- Hover 时应该显示 "Switch to voice chat" 提示
- 点击后跳转到 `/[locale]/[workspaceid]/voice-chat/[chatid]`
- 页面应该显示语音聊天界面,包含:
  - 大麦克风按钮
  - 波形可视化区域
  - 聊天消息历史

### 步骤 6: 测试语音录制
1. 点击大麦克风按钮
2. 浏览器会请求麦克风权限 → **点击允许**
3. 应该看到:
   - 波形开始跳动
   - 录音时长计时器
   - 红色停止按钮和其他控制按钮

---

## 🐛 调试技巧

### 打开浏览器控制台
`F12` 或 右键 → 检查

查看是否有以下错误:
- ❌ 路由 404 错误
- ❌ Component not found
- ❌ API 调用失败

### 检查组件是否加载
在浏览器控制台运行:
```javascript
// 检查 ChatSecondaryButtons 是否渲染
document.querySelector('[data-radix-tooltip-trigger]')
```

### 查看 Next.js 编译日志
在运行 `npm run chat` 的终端窗口,查看是否有编译错误或警告。

---

## ✅ 成功标志

如果一切正常,你应该能:

1. ✅ 在聊天页面右上角看到 🎤 图标
2. ✅ 点击后跳转到语音聊天页面
3. ✅ 看到大麦克风按钮和波形可视化
4. ✅ 点击麦克风后浏览器请求权限
5. ✅ 录音时看到实时波形
6. ✅ 停止录音后自动转文字并发送

---

## 📞 如果仍然看不到按钮

请检查以下内容并提供给我:

1. **浏览器控制台截图** (F12)
2. **终端编译日志** (运行 npm run chat 的输出)
3. **当前页面 URL** (例如: `http://localhost:3000/en/workspace-123/chat/chat-456`)
4. **是否选中了聊天** (左侧边栏是否高亮某个聊天)

运行以下命令检查文件:
```bash
# 检查 chat-secondary-buttons.tsx 是否正确修改
cat components/chat/chat-secondary-buttons.tsx | grep -A 20 "IconMicrophone"

# 检查路由文件是否存在
ls -R app/[locale]/[workspaceid]/voice-chat/
```
