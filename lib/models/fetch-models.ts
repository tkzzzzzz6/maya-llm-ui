import { Tables } from "@/supabase/types"
import { LLM, LLMID, OpenRouterLLM } from "@/types"
import { toast } from "sonner"
import { LLM_LIST_MAP } from "./llm/llm-list"

export const fetchHostedModels = async (
  profile: Tables<"profiles">,
  useDynamicFetch: boolean = false
) => {
  try {
    const providers = ["google", "anthropic", "mistral", "groq", "perplexity"]

    if (profile.use_azure_openai) {
      providers.push("azure")
    } else {
      providers.push("openai")
    }

    const response = await fetch("/api/keys")

    if (!response.ok) {
      throw new Error(`Server is not responding.`)
    }

    const data = await response.json()

    let modelsToAdd: LLM[] = []

    for (const provider of providers) {
      let providerKey: keyof typeof profile

      if (provider === "google") {
        providerKey = "google_gemini_api_key"
      } else if (provider === "azure") {
        providerKey = "azure_openai_api_key"
      } else {
        providerKey = `${provider}_api_key` as keyof typeof profile
      }

      if (profile?.[providerKey] || data.isUsingEnvKeyMap[provider]) {
        // 如果启用动态获取且提供商支持，则使用 API 获取
        if (useDynamicFetch && profile?.[providerKey]) {
          const apiKey = profile[providerKey] as string

          if (provider === "google") {
            const dynamicModels = await fetchGoogleModels(apiKey)
            if (dynamicModels && dynamicModels.length > 0) {
              modelsToAdd.push(...dynamicModels)
              continue
            }
          } else if (provider === "openai") {
            const dynamicModels = await fetchOpenAIModels(apiKey)
            if (dynamicModels && dynamicModels.length > 0) {
              modelsToAdd.push(...dynamicModels)
              continue
            }
          } else if (provider === "anthropic") {
            const dynamicModels = await fetchAnthropicModels(apiKey)
            if (dynamicModels && dynamicModels.length > 0) {
              modelsToAdd.push(...dynamicModels)
              continue
            }
          }
        }

        // 回退到静态模型列表
        const models = LLM_LIST_MAP[provider]

        if (Array.isArray(models)) {
          modelsToAdd.push(...models)
        }
      }
    }

    return {
      envKeyMap: data.isUsingEnvKeyMap,
      hostedModels: modelsToAdd
    }
  } catch (error) {
    console.warn("Error fetching hosted models: " + error)
  }
}

export const fetchOllamaModels = async () => {
  try {
    // 使用 Next.js API 代理路由，这样远程用户也能访问
    const response = await fetch("/api/ollama?path=/api/tags")

    if (!response.ok) {
      throw new Error(`Ollama server is not responding.`)
    }

    const data = await response.json()

    const localModels: LLM[] = data.models.map((model: any) => ({
      modelId: model.name as LLMID,
      modelName: model.name,
      provider: "ollama",
      hostedId: model.name,
      platformLink: "https://ollama.ai/library",
      imageInput: false
    }))

    return localModels
  } catch (error) {
    console.warn("Error fetching Ollama models: " + error)
  }
}

export const fetchOpenRouterModels = async () => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models")

    if (!response.ok) {
      throw new Error(`OpenRouter server is not responding.`)
    }

    const { data } = await response.json()

    const openRouterModels = data.map(
      (model: {
        id: string
        name: string
        context_length: number
      }): OpenRouterLLM => ({
        modelId: model.id as LLMID,
        modelName: model.id,
        provider: "openrouter",
        hostedId: model.name,
        platformLink: "https://openrouter.dev",
        imageInput: false,
        maxContext: model.context_length
      })
    )

    return openRouterModels
  } catch (error) {
    console.error("Error fetching Open Router models: " + error)
    toast.error("Error fetching Open Router models: " + error)
  }
}

export const fetchGoogleModels = async (apiKey: string) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    )

    if (!response.ok) {
      throw new Error(`Google API server is not responding.`)
    }

    const data = await response.json()

    const googleModels: LLM[] = data.models
      .filter((model: any) => {
        // 只包含支持 generateContent 的模型
        return (
          model.supportedGenerationMethods?.includes("generateContent") &&
          model.name.includes("gemini")
        )
      })
      .map((model: any) => {
        const modelId = model.name.replace("models/", "")
        return {
          modelId: modelId as LLMID,
          modelName: model.displayName || modelId,
          provider: "google",
          hostedId: modelId,
          platformLink: "https://ai.google.dev/",
          imageInput:
            model.supportedGenerationMethods?.includes("generateImage") ||
            modelId.includes("vision")
        }
      })

    return googleModels
  } catch (error) {
    console.error("Error fetching Google models: " + error)
    toast.error("Error fetching Google models: " + error)
    return []
  }
}

export const fetchOpenAIModels = async (apiKey: string, baseURL?: string) => {
  try {
    // 使用自定义 URL 或默认 OpenAI URL
    const apiUrl =
      baseURL || process.env.OPENAI_API_URL || "https://api.openai.com/v1"

    const response = await fetch(`${apiUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      throw new Error(`OpenAI API server is not responding.`)
    }

    const { data } = await response.json()

    const openaiModels: LLM[] = data
      .filter((model: any) => {
        // 只包含 GPT 和 o 系列模型（过滤掉 embedding、tts 等其他模型）
        const id = model.id
        return (
          id.startsWith("gpt-") ||
          id.startsWith("o1") ||
          id.startsWith("o3") ||
          id.startsWith("o4")
        )
      })
      .map((model: any) => ({
        modelId: model.id as LLMID,
        modelName: model.id,
        provider: "openai",
        hostedId: model.id,
        platformLink: "https://platform.openai.com/docs/overview",
        imageInput:
          model.id.includes("vision") ||
          model.id.includes("gpt-4o") ||
          model.id.startsWith("o3") ||
          model.id.startsWith("o4")
      }))

    return openaiModels
  } catch (error) {
    console.error("Error fetching OpenAI models: " + error)
    toast.error("Error fetching OpenAI models: " + error)
    return []
  }
}

export const fetchAnthropicModels = async (
  apiKey: string,
  baseURL?: string
) => {
  try {
    // 使用自定义 URL 或默认 Anthropic URL
    const apiUrl =
      baseURL || process.env.ANTHROPIC_API_URL || "https://api.anthropic.com"

    const response = await fetch(`${apiUrl}/v1/models`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    })

    if (!response.ok) {
      throw new Error(`Anthropic API server is not responding.`)
    }

    const { data } = await response.json()

    const anthropicModels: LLM[] = data.map((model: any) => ({
      modelId: model.id as LLMID,
      modelName: model.display_name || model.id,
      provider: "anthropic",
      hostedId: model.id,
      platformLink:
        "https://docs.anthropic.com/claude/reference/getting-started-with-the-api",
      imageInput: true // Claude 3+ 都支持图像输入
    }))

    return anthropicModels
  } catch (error) {
    console.error("Error fetching Anthropic models: " + error)
    toast.error("Error fetching Anthropic models: " + error)
    return []
  }
}
