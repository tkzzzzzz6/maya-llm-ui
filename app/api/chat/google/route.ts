import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { GoogleGenerativeAI } from "@google/generative-ai"

// 改用 nodejs runtime 以支持代理
export const runtime = "nodejs"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()
    checkApiKey(profile.google_gemini_api_key, "Google")

    const apiKey = profile.google_gemini_api_key || ""
    const customBaseUrl =
      process.env.GOOGLE_API_URL || process.env.GOOGLE_GEMINI_API_URL

    // 如果配置了自定义 URL，使用原生 fetch
    if (customBaseUrl) {
      return await handleCustomUrlRequest(
        customBaseUrl,
        apiKey,
        chatSettings,
        messages
      )
    }

    // 否则使用官方 SDK
    const genAI = new GoogleGenerativeAI(apiKey)
    const googleModel = genAI.getGenerativeModel({ model: chatSettings.model })

    const lastMessage = messages.pop()

    const chat = googleModel.startChat({
      history: messages,
      generationConfig: {
        temperature: chatSettings.temperature
      }
    })

    const response = await chat.sendMessageStream(lastMessage.parts)

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response.stream) {
          const chunkText = chunk.text()
          controller.enqueue(encoder.encode(chunkText))
        }
        controller.close()
      }
    })

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain" }
    })
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "Google Gemini API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("api key not valid")) {
      errorMessage =
        "Google Gemini API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}

async function handleCustomUrlRequest(
  baseUrl: string,
  apiKey: string,
  chatSettings: ChatSettings,
  messages: any[]
) {
  // 构建 Google API 格式的请求
  const contents = messages.map(msg => ({
    role: msg.role === "model" ? "model" : "user",
    parts: msg.parts || [{ text: msg.content || "" }]
  }))

  const url = `${baseUrl}/v1beta/models/${chatSettings.model}:streamGenerateContent?key=${apiKey}&alt=sse`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: chatSettings.temperature
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google API error: ${error}`)
  }

  // 处理 SSE 流式响应
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue

              try {
                const json = JSON.parse(data)
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  controller.enqueue(encoder.encode(text))
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
        controller.close()
      }
    }
  })

  return new Response(readableStream, {
    headers: { "Content-Type": "text/plain" }
  })
}
