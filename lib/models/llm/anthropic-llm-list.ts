import { LLM } from "@/types"

const ANTHROPIC_PLATFORM_LINK =
  "https://docs.anthropic.com/claude/reference/getting-started-with-the-api"

// Anthropic Models (UPDATED 10/06/25) -----------------------------

// Claude Sonnet 4.5 (UPDATED 10/06/25)
const CLAUDE_SONNET_4_5: LLM = {
  modelId: "claude-sonnet-4.5",
  modelName: "Claude Sonnet 4.5",
  provider: "anthropic",
  hostedId: "claude-sonnet-4.5",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 3,
    outputCost: 15
  }
}

// Claude 3.5 Sonnet v2 (UPDATED 10/06/25)
const CLAUDE_3_5_SONNET_V2: LLM = {
  modelId: "claude-3-5-sonnet-20241022",
  modelName: "Claude 3.5 Sonnet v2",
  provider: "anthropic",
  hostedId: "claude-3-5-sonnet-20241022",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 3,
    outputCost: 15
  }
}

// Claude 3.5 Haiku (UPDATED 10/06/25)
const CLAUDE_3_5_HAIKU: LLM = {
  modelId: "claude-3-5-haiku-20241022",
  modelName: "Claude 3.5 Haiku",
  provider: "anthropic",
  hostedId: "claude-3-5-haiku-20241022",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.8,
    outputCost: 4
  }
}

// Claude 3.5 Sonnet (Original)
const CLAUDE_3_5_SONNET: LLM = {
  modelId: "claude-3-5-sonnet-20240620",
  modelName: "Claude 3.5 Sonnet",
  provider: "anthropic",
  hostedId: "claude-3-5-sonnet-20240620",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 3,
    outputCost: 15
  }
}

// Claude 3 Opus
const CLAUDE_3_OPUS: LLM = {
  modelId: "claude-3-opus-20240229",
  modelName: "Claude 3 Opus",
  provider: "anthropic",
  hostedId: "claude-3-opus-20240229",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 15,
    outputCost: 75
  }
}

// Claude 3 Sonnet
const CLAUDE_3_SONNET: LLM = {
  modelId: "claude-3-sonnet-20240229",
  modelName: "Claude 3 Sonnet",
  provider: "anthropic",
  hostedId: "claude-3-sonnet-20240229",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 3,
    outputCost: 15
  }
}

// Claude 3 Haiku
const CLAUDE_3_HAIKU: LLM = {
  modelId: "claude-3-haiku-20240307",
  modelName: "Claude 3 Haiku",
  provider: "anthropic",
  hostedId: "claude-3-haiku-20240307",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.25,
    outputCost: 1.25
  }
}

// Claude 2 (Legacy)
const CLAUDE_2: LLM = {
  modelId: "claude-2.1",
  modelName: "Claude 2",
  provider: "anthropic",
  hostedId: "claude-2.1",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 8,
    outputCost: 24
  }
}

// Claude Instant (Legacy)
const CLAUDE_INSTANT: LLM = {
  modelId: "claude-instant-1.2",
  modelName: "Claude Instant",
  provider: "anthropic",
  hostedId: "claude-instant-1.2",
  platformLink: ANTHROPIC_PLATFORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.8,
    outputCost: 2.4
  }
}

export const ANTHROPIC_LLM_LIST: LLM[] = [
  CLAUDE_SONNET_4_5,
  CLAUDE_3_5_SONNET_V2,
  CLAUDE_3_5_HAIKU,
  CLAUDE_3_5_SONNET,
  CLAUDE_3_OPUS,
  CLAUDE_3_SONNET,
  CLAUDE_3_HAIKU,
  CLAUDE_2,
  CLAUDE_INSTANT
]
