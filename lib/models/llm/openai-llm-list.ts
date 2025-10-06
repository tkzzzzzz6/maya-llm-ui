import { LLM } from "@/types"

const OPENAI_PLATORM_LINK = "https://platform.openai.com/docs/overview"

// OpenAI Models (UPDATED 10/06/25) -----------------------------

// o3 (UPDATED 10/06/25)
const O3: LLM = {
  modelId: "o3",
  modelName: "o3",
  provider: "openai",
  hostedId: "o3",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 10,
    outputCost: 40
  }
}

// o3-pro (UPDATED 10/06/25)
const O3_PRO: LLM = {
  modelId: "o3-pro",
  modelName: "o3 Pro",
  provider: "openai",
  hostedId: "o3-pro",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 15,
    outputCost: 60
  }
}

// o4-mini (UPDATED 10/06/25)
const O4_MINI: LLM = {
  modelId: "o4-mini",
  modelName: "o4 Mini",
  provider: "openai",
  hostedId: "o4-mini",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 1.5,
    outputCost: 6
  }
}

// GPT-4.1 (UPDATED 10/06/25)
const GPT4_1: LLM = {
  modelId: "gpt-4.1",
  modelName: "GPT-4.1",
  provider: "openai",
  hostedId: "gpt-4.1",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 5,
    outputCost: 15
  }
}

// GPT-4.1 Mini (UPDATED 10/06/25)
const GPT4_1_MINI: LLM = {
  modelId: "gpt-4.1-mini",
  modelName: "GPT-4.1 Mini",
  provider: "openai",
  hostedId: "gpt-4.1-mini",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.15,
    outputCost: 0.6
  }
}

// GPT-4o
const GPT4o: LLM = {
  modelId: "gpt-4o",
  modelName: "GPT-4o",
  provider: "openai",
  hostedId: "gpt-4o",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 5,
    outputCost: 15
  }
}

// GPT-4 Turbo
const GPT4Turbo: LLM = {
  modelId: "gpt-4-turbo-preview",
  modelName: "GPT-4 Turbo",
  provider: "openai",
  hostedId: "gpt-4-turbo-preview",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 10,
    outputCost: 30
  }
}

// GPT-4 Vision (Legacy)
const GPT4Vision: LLM = {
  modelId: "gpt-4-vision-preview",
  modelName: "GPT-4 Vision",
  provider: "openai",
  hostedId: "gpt-4-vision-preview",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 10,
    outputCost: 30
  }
}

// GPT-4 (Legacy)
const GPT4: LLM = {
  modelId: "gpt-4",
  modelName: "GPT-4",
  provider: "openai",
  hostedId: "gpt-4",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 30,
    outputCost: 60
  }
}

// GPT-3.5 Turbo (Legacy)
const GPT3_5Turbo: LLM = {
  modelId: "gpt-3.5-turbo",
  modelName: "GPT-3.5 Turbo",
  provider: "openai",
  hostedId: "gpt-3.5-turbo",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.5,
    outputCost: 1.5
  }
}

export const OPENAI_LLM_LIST: LLM[] = [
  O3_PRO,
  O3,
  O4_MINI,
  GPT4_1,
  GPT4_1_MINI,
  GPT4o,
  GPT4Turbo,
  GPT4Vision,
  GPT4,
  GPT3_5Turbo
]
