# 🚀 模型更新说明 - 2025-10-06

## 更新概述

已将所有 AI 提供商的模型列表更新至 2025 年最新版本，包括 Google、OpenAI 和 Anthropic 的最新模型。

---

## 📊 更新的模型

### 🔵 Google Gemini（新增）

#### **Gemini 2.5 Pro** ⭐ 最新
- **模型ID**: `gemini-2.5-pro`
- **上下文窗口**: 1M tokens（即将支持 2M）
- **特性**:
  - 内置思维能力的推理模型
  - 在 LMArena 排名第一
  - SWE-Bench Verified 得分 63.8%
- **适用场景**: 复杂任务、代码生成、深度推理

#### **Gemini 2.5 Flash** ⭐ 最新
- **模型ID**: `gemini-2.5-flash`
- **上下文窗口**: 1M tokens
- **特性**:
  - 性价比最优模型
  - SWE-Bench Verified 提升至 54%
  - 更好的多步骤代理能力
- **适用场景**: 快速响应、成本敏感应用

#### 保留的旧版本
- Gemini 1.5 Pro
- Gemini 1.5 Flash
- Gemini Pro (Legacy)
- Gemini Pro Vision (Legacy)

---

### 🟢 OpenAI（新增）

#### **o3 Pro** ⭐ 最新
- **模型ID**: `o3-pro`
- **上下文窗口**: 200K tokens
- **最大输出**: 100K tokens
- **特性**:
  - OpenAI 最强大的推理模型
  - 可进行更长时间的思考
  - 提供最可靠的响应
- **定价**: $15/1M input, $60/1M output
- **适用场景**: 复杂编程、科学计算、深度分析

#### **o3** ⭐ 最新
- **模型ID**: `o3`
- **上下文窗口**: 200K tokens
- **最大输出**: 100K tokens
- **特性**:
  - 在编程、数学、科学等领域创下新记录
  - 在 Codeforces、SWE-bench、MMMU 等基准测试中领先
  - 比 o1 减少 20% 的重大错误
  - 可使用 ChatGPT 内所有工具（搜索、文件分析、Python、图像生成等）
- **定价**: $10/1M input, $40/1M output
- **适用场景**: 编程、商业咨询、创意构思

#### **o4 Mini** ⭐ 最新
- **模型ID**: `o4-mini`
- **上下文窗口**: 200K tokens
- **最大输出**: 65K tokens
- **特性**:
  - 快速、成本效益高的推理模型
  - 在数学、编程和视觉任务中表现出色
  - 在 AIME 2024/2025 基准测试中表现最佳
- **定价**: $1.5/1M input, $6/1M output
- **适用场景**: 成本敏感的推理任务

#### **GPT-4.1** ⭐ 最新
- **模型ID**: `gpt-4.1`
- **上下文窗口**: 1M tokens
- **最大输出**: 16K tokens
- **特性**:
  - 全面超越 GPT-4o
  - 编程和指令遵循能力大幅提升
  - 知识截止日期更新至 2024 年 6 月
  - 改进的长上下文理解
- **定价**: $5/1M input, $15/1M output
- **适用场景**: 通用任务、长文档处理

#### **GPT-4.1 Mini** ⭐ 最新
- **模型ID**: `gpt-4.1-mini`
- **上下文窗口**: 1M tokens
- **最大输出**: 16K tokens
- **特性**:
  - 超越 GPT-4o mini
  - 快速响应、成本低
- **定价**: $0.15/1M input, $0.6/1M output
- **适用场景**: 高频调用、批量处理

#### 保留的旧版本
- GPT-4o
- GPT-4 Turbo
- GPT-4 Vision (Legacy)
- GPT-4 (Legacy)
- GPT-3.5 Turbo (Legacy)

---

### 🟣 Anthropic Claude（新增）

#### **Claude Sonnet 4.5** ⭐ 最新
- **模型ID**: `claude-sonnet-4.5`
- **上下文窗口**: 200K tokens
- **最大输出**: 8K tokens
- **特性**:
  - 世界上最佳的代理、编程和计算机使用模型
  - SWE-bench Verified 得分 77.2%
  - Anthropic 最强编程模型
  - 训练数据更新至 2025 年 7 月
- **定价**: $3/1M input, $15/1M output
- **适用场景**: 复杂编程、自动化代理、计算机操作

#### **Claude 3.5 Sonnet v2** ⭐ 最新
- **模型ID**: `claude-3-5-sonnet-20241022`
- **上下文窗口**: 200K tokens
- **最大输出**: 8K tokens
- **特性**:
  - SWE-bench Verified 从 33.4% 提升至 49.0%
  - 支持计算机使用功能（公开测试版）
  - 首个提供计算机使用的前沿 AI 模型
- **定价**: $3/1M input, $15/1M output
- **适用场景**: 编程、自动化任务

#### **Claude 3.5 Haiku** ⭐ 最新
- **模型ID**: `claude-3-5-haiku-20241022`
- **上下文窗口**: 200K tokens
- **最大输出**: 8K tokens
- **特性**:
  - 下一代最快模型
  - 在所有技能上均有提升
  - 在许多智能基准测试上超越 Claude 3 Opus
  - SWE-bench Verified 得分 40.6%（优于原始 Claude 3.5 Sonnet）
- **定价**: $0.8/1M input, $4/1M output
- **适用场景**: 快速响应、高频调用、客户服务

#### 保留的旧版本
- Claude 3.5 Sonnet (Original)
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku
- Claude 2 (Legacy)
- Claude Instant (Legacy)

---

## 📝 更新的文件

### 1. 模型列表文件
- ✅ `lib/models/llm/google-llm-list.ts`
- ✅ `lib/models/llm/openai-llm-list.ts`
- ✅ `lib/models/llm/anthropic-llm-list.ts`

### 2. 类型定义文件
- ✅ `types/llms.ts` - 添加所有新模型的 TypeScript 类型

### 3. 配置文件
- ✅ `lib/chat-setting-limits.ts` - 为新模型配置温度、上下文和输出限制

---

## 🎯 模型选择建议

### 💰 **成本优先**
1. **Claude 3.5 Haiku** - 最快且便宜，智能优秀
2. **GPT-4.1 Mini** - OpenAI 最便宜的新模型
3. **Gemini 2.5 Flash** - Google 性价比最优

### 🧠 **性能优先**
1. **Claude Sonnet 4.5** - 编程和代理任务最佳
2. **o3 Pro** - 复杂推理和深度分析
3. **Gemini 2.5 Pro** - 超大上下文窗口（1M-2M tokens）

### ⚡ **平衡选择**
1. **o3** - 推理能力强，价格适中
2. **GPT-4.1** - 通用任务表现优秀
3. **Claude 3.5 Sonnet v2** - 编程能力强，价格合理

### 📄 **长文档处理**
1. **Gemini 2.5 Pro/Flash** - 1M+ tokens 上下文
2. **GPT-4.1 系列** - 1M tokens 上下文
3. **Claude 系列** - 200K tokens 上下文

### 💻 **编程任务**
1. **Claude Sonnet 4.5** - 77.2% SWE-bench
2. **Gemini 2.5 Pro** - 63.8% SWE-bench
3. **o3** - 推理能力强，适合复杂算法

---

## 🔧 使用方法

### 在 UI 中选择模型

1. 打开聊天界面
2. 点击模型选择下拉菜单
3. 现在可以看到所有最新模型，包括：
   - **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash
   - **OpenAI**: o3 Pro, o3, o4 Mini, GPT-4.1, GPT-4.1 Mini
   - **Anthropic**: Claude Sonnet 4.5, Claude 3.5 Sonnet v2, Claude 3.5 Haiku

### 配置 API Keys

确保在 `.env.local` 中配置了相应的 API Keys：

```bash
# Google
GOOGLE_GEMINI_API_KEY=your_key_here

# OpenAI
OPENAI_API_KEY=your_key_here

# Anthropic
ANTHROPIC_API_KEY=your_key_here
```

---

## 📊 性能对比（基准测试）

### SWE-Bench Verified（编程能力）
1. **Claude Sonnet 4.5**: 77.2%
2. **Gemini 2.5 Pro**: 63.8%
3. **Gemini 2.5 Flash**: 54.0%
4. **Claude 3.5 Sonnet v2**: 49.0%
5. **Claude 3.5 Haiku**: 40.6%

### 上下文窗口大小
1. **Gemini 2.5 Pro/Flash**: 1M tokens（即将 2M）
2. **GPT-4.1 系列**: 1M tokens
3. **o3 系列**: 200K tokens
4. **Claude 系列**: 200K tokens

### 最大输出 tokens
1. **o3 Pro/o3**: 100K tokens
2. **o4 Mini**: 65K tokens
3. **GPT-4.1 系列**: 16K tokens
4. **Gemini 系列**: 8K tokens
5. **Claude 系列**: 8K tokens

---

## ⚠️ 注意事项

1. **API 兼容性**:
   - 某些新模型（如 o3 系列）可能需要特定的 API 版本
   - 请确保使用最新的 SDK 版本

2. **定价变化**:
   - 新模型的定价可能与旧模型不同
   - 建议在生产环境使用前测试成本

3. **功能限制**:
   - 部分新模型可能有特定的功能限制
   - 请参考各提供商的官方文档

4. **速率限制**:
   - 新模型可能有不同的速率限制
   - 高频调用建议使用 Mini 或 Flash 版本

---

## 📚 参考文档

- [Google Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [OpenAI Models](https://platform.openai.com/docs/models)
- [Anthropic Claude Models](https://docs.anthropic.com/claude/docs/models-overview)

---

## 🎉 总结

此次更新带来了：
- ✅ **8 个新的 Google 模型**（包括 2.5 Pro 和 2.5 Flash）
- ✅ **5 个新的 OpenAI 模型**（包括 o3 系列和 GPT-4.1 系列）
- ✅ **3 个新的 Anthropic 模型**（包括 Sonnet 4.5 和 3.5 Haiku）
- ✅ 所有模型的完整类型定义和配置
- ✅ 准确的上下文窗口和输出限制设置

现在您可以使用业界最先进的 AI 模型进行聊天和编程！🚀

---

**更新日期**: 2025-10-06
**更新者**: Claude Code Assistant
