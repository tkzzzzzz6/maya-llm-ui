# 🌐 OpenAI 镜像 API 配置指南

## 概述

Chatbot UI 现在支持使用**自定义 OpenAI API URL**，这意味着您可以：

- ✅ 使用 OpenAI 镜像 API 服务
- ✅ 使用 OpenAI 兼容的第三方 API
- ✅ 使用企业内部的 OpenAI 代理
- ✅ 在中国等地区使用加速服务

## 🚀 快速开始

### 配置环境变量

在 `.env.local` 文件中添加：

```bash
# 使用自定义 OpenAI API URL
OPENAI_API_URL=https://your-mirror-api.com/v1
```

### 示例配置

#### 1. 使用 OpenAI 镜像服务

```bash
# 示例镜像服务（请替换为实际的镜像地址）
OPENAI_API_URL=https://api.gptsapi.net/v1
OPENAI_API_URL=https://api.openai-proxy.com/v1
OPENAI_API_URL=https://api.openai-sb.com/v1
```

#### 2. 使用企业代理

```bash
# 企业内部代理
OPENAI_API_URL=https://openai-proxy.your-company.com/v1
```

#### 3. 使用兼容服务

```bash
# 使用 Groq（通过 OpenAI 兼容接口）
OPENAI_API_URL=https://api.groq.com/openai/v1

# 使用 Together AI
OPENAI_API_URL=https://api.together.xyz/v1
```

#### 4. 默认 OpenAI（不配置）

如果不设置 `OPENAI_API_URL`，将使用官方 OpenAI API：

```bash
# 默认值（可以不配置）
OPENAI_API_URL=https://api.openai.com/v1
```

---

## 📋 支持的功能

所有使用 OpenAI API 的功能都支持自定义 URL：

| 功能 | 文件路径 | 支持状态 |
|------|---------|---------|
| **聊天对话** | `app/api/chat/openai/route.ts` | ✅ |
| **工具调用** | `app/api/chat/tools/route.ts` | ✅ |
| **命令功能** | `app/api/command/route.ts` | ✅ |
| **OpenAI Assistants** | `app/api/assistants/openai/route.ts` | ✅ |
| **文档检索（Embeddings）** | `app/api/retrieval/retrieve/route.ts` | ✅ |
| **文档处理（Embeddings）** | `app/api/retrieval/process/route.ts` | ✅ |
| **DOCX 处理** | `app/api/retrieval/process/docx/route.ts` | ✅ |
| **动态模型获取** | `lib/models/fetch-models.ts` | ✅ |

---

## 🔧 技术实现

### 代码修改

所有使用 `new OpenAI()` 的地方都已更新为支持自定义 `baseURL`：

```typescript
// 之前
const openai = new OpenAI({
  apiKey: profile.openai_api_key || "",
  organization: profile.openai_organization_id
})

// 现在
const openai = new OpenAI({
  apiKey: profile.openai_api_key || "",
  organization: profile.openai_organization_id,
  baseURL: process.env.OPENAI_API_URL || "https://api.openai.com/v1"
})
```

### 动态模型获取

`fetchOpenAIModels` 函数也支持自定义 URL：

```typescript
export const fetchOpenAIModels = async (
  apiKey: string,
  baseURL?: string
) => {
  const apiUrl =
    baseURL ||
    process.env.OPENAI_API_URL ||
    "https://api.openai.com/v1"

  const response = await fetch(`${apiUrl}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  })
  // ...
}
```

---

## 🌍 常见镜像服务

### 中国大陆可用的镜像

> ⚠️ **免责声明**：以下列表仅供参考，请自行验证服务的可靠性和合法性。

| 服务商 | API 端点 | 说明 |
|--------|---------|------|
| **示例服务 1** | `https://api.gptsapi.net/v1` | 需要注册账号 |
| **示例服务 2** | `https://api.openai-proxy.com/v1` | 需要自己的 OpenAI Key |
| **示例服务 3** | `https://api.openai-sb.com/v1` | 付费服务 |

### 国际服务

| 服务商 | API 端点 | 说明 |
|--------|---------|------|
| **OpenAI 官方** | `https://api.openai.com/v1` | 默认 |
| **Azure OpenAI** | 使用 Azure 配置 | 见 Azure 文档 |
| **Cloudflare AI Gateway** | `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai` | Cloudflare 代理 |

---

## 🔍 验证配置

### 1. 测试 API 连接

使用 curl 测试您的镜像 API 是否可用：

```bash
curl https://your-mirror-api.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 2. 检查模型列表

成功的响应示例：

```json
{
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1234567890
    },
    // ... more models
  ]
}
```

### 3. 在应用中测试

1. 配置 `.env.local` 中的 `OPENAI_API_URL`
2. 重启开发服务器：`npm run restart`
3. 在聊天界面选择 OpenAI 模型
4. 发送测试消息

---

## ⚠️ 注意事项

### 1. API 兼容性

确保镜像 API 完全兼容 OpenAI API 规范：

- ✅ 支持 `/v1/chat/completions` 端点
- ✅ 支持 `/v1/models` 端点（用于动态模型获取）
- ✅ 支持 `/v1/embeddings` 端点（用于文档检索）
- ✅ 请求和响应格式与 OpenAI 一致

### 2. API Key 管理

- 某些镜像服务使用自己的 API Key
- 某些镜像服务需要您提供 OpenAI API Key
- 请妥善保管您的 API Key

### 3. 数据安全

- ⚠️ 使用第三方镜像服务时，您的对话数据会经过第三方服务器
- ⚠️ 请确保镜像服务提供商值得信任
- ⚠️ 不要在对话中包含敏感信息

### 4. 服务稳定性

- 镜像服务的稳定性可能不如官方服务
- 建议配置备用方案
- 注意速率限制和配额

---

## 🛠️ 高级配置

### 使用多个镜像（轮询）

您可以在应用层实现多镜像轮询：

```typescript
// 在 lib/models/fetch-models.ts 中
const MIRROR_URLS = [
  "https://api.mirror1.com/v1",
  "https://api.mirror2.com/v1",
  "https://api.mirror3.com/v1"
]

async function fetchWithRetry(urls: string[]) {
  for (const url of urls) {
    try {
      return await fetchOpenAIModels(apiKey, url)
    } catch (error) {
      console.warn(`Failed with ${url}, trying next...`)
    }
  }
  throw new Error("All mirrors failed")
}
```

### 按用户配置

未来可以支持每个用户配置自己的镜像 URL：

```sql
-- 在 profiles 表中添加字段
ALTER TABLE profiles ADD COLUMN openai_base_url TEXT;
```

---

## 🐛 故障排查

### 问题：连接超时

**症状**：请求一直等待，最终超时

**解决方案**：
1. 检查镜像 URL 是否正确
2. 检查网络连接
3. 尝试使用其他镜像服务

### 问题：401 Unauthorized

**症状**：返回 "API key not found" 或 "Incorrect API key"

**解决方案**：
1. 检查 API Key 是否正确
2. 确认镜像服务是否需要特定格式的 API Key
3. 检查镜像服务是否支持您的 API Key

### 问题：模型列表为空

**症状**：动态模型获取失败，返回空列表

**解决方案**：
1. 检查镜像服务是否支持 `/v1/models` 端点
2. 查看浏览器控制台错误信息
3. 尝试手动调用 API 测试

### 问题：响应格式不兼容

**症状**：API 调用成功但解析失败

**解决方案**：
1. 确认镜像服务完全兼容 OpenAI API 格式
2. 检查响应的 JSON 结构
3. 联系镜像服务提供商

---

## 📚 相关文档

- [OpenAI API 官方文档](https://platform.openai.com/docs/api-reference)
- [动态模型获取文档](./DYNAMIC_MODEL_FETCHING.md)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)

---

## 💡 最佳实践

### 1. 开发环境

```bash
# .env.local (开发)
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-dev-key
```

### 2. 生产环境

```bash
# .env.production (生产)
OPENAI_API_URL=https://your-stable-mirror.com/v1
OPENAI_API_KEY=sk-your-prod-key
```

### 3. 中国大陆部署

```bash
# .env.local (中国大陆)
OPENAI_API_URL=https://your-china-mirror.com/v1
OPENAI_API_KEY=sk-your-key
```

---

## 🆘 获取帮助

### 遇到问题？

1. 查看浏览器控制台错误信息
2. 检查服务器日志
3. 参考本文档的故障排查部分
4. 在 GitHub 提交 Issue

### 推荐镜像服务

如果您知道稳定可靠的镜像服务，欢迎贡献到项目文档！

---

## 📝 示例配置文件

### 完整的 .env.local 示例

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://0.0.0.0:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (使用镜像)
OPENAI_API_KEY=sk-your-api-key
OPENAI_API_URL=https://api.gptsapi.net/v1
NEXT_PUBLIC_OPENAI_ORGANIZATION_ID=

# 其他 AI 服务
ANTHROPIC_API_KEY=
GOOGLE_GEMINI_API_KEY=
```

---

## ✅ 总结

通过配置 `OPENAI_API_URL` 环境变量，您可以：

1. ✅ 使用任何 OpenAI 兼容的 API 服务
2. ✅ 在中国大陆等地区正常使用
3. ✅ 通过企业代理访问 OpenAI
4. ✅ 使用更稳定或更便宜的镜像服务
5. ✅ 无需修改代码，只需配置环境变量

**配置简单，功能强大！** 🎉

---

**创建时间**: 2025-10-06
**作者**: Claude Code Assistant
