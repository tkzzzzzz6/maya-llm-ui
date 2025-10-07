import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { HttpsProxyAgent } from "https-proxy-agent"
import https from "https"
import { URL } from "url"

// 改用 nodejs runtime 以支持代理
export const runtime = "nodejs"

// 创建支持代理的 agent
function getProxyAgent() {
  // 优先使用环境变量，否则使用硬编码的代理地址（Windows 环境）
  const proxy =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    "http://172.24.240.1:10808" // 硬编码代理作为后备
  // 192.168.243.93

  console.log("Using proxy:", proxy)
  return new HttpsProxyAgent(proxy)
}

// 使用原生 https 模块发送请求（支持代理）
function httpsRequest(url: string, options: any, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const agent = getProxyAgent()

    console.log("Agent:", agent ? "Using proxy agent" : "Direct connection")
    console.log(
      "Proxy from env:",
      process.env.https_proxy || process.env.http_proxy || "None"
    )

    const requestOptions: any = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "POST",
      headers: options.headers || {}
    }

    // 必须显式设置 agent
    if (agent) {
      requestOptions.agent = agent
    }

    console.log(
      "Request options:",
      JSON.stringify(
        { ...requestOptions, agent: agent ? "ProxyAgent" : undefined },
        null,
        2
      )
    )

    const req = https.request(requestOptions, res => {
      resolve(res)
    })

    req.on("error", error => {
      reject(error)
    })

    if (body) {
      req.write(body)
    }

    req.end()
  })
}

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

  const requestBody = JSON.stringify({
    contents,
    generationConfig: {
      temperature: chatSettings.temperature
    }
  })

  console.log("Fetching Google API:", url)
  console.log("Request body:", requestBody)

  try {
    const response = (await httpsRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody)
        }
      },
      requestBody
    )) as any

    console.log("Response status:", response.statusCode)

    if (response.statusCode !== 200) {
      let errorText = ""
      for await (const chunk of response) {
        errorText += chunk.toString()
      }
      console.error("Google API error response:", errorText)
      throw new Error(`Google API error (${response.statusCode}): ${errorText}`)
    }

    // 处理 SSE 流式响应
    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        let buffer = ""

        try {
          for await (const chunk of response) {
            buffer += chunk.toString()
            const lines = buffer.split("\n")

            // 保留最后一行（可能不完整）
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim()
                if (data === "[DONE]" || !data) continue

                try {
                  const json = JSON.parse(data)
                  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    controller.enqueue(encoder.encode(text))
                  }
                } catch (e) {
                  // 忽略解析错误
                  console.error("Parse error:", e, "Data:", data)
                }
              }
            }
          }
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain" }
    })
  } catch (fetchError: any) {
    console.error("Fetch error details:", fetchError)
    throw new Error(`Failed to connect to Google API: ${fetchError.message}`)
  }
}
