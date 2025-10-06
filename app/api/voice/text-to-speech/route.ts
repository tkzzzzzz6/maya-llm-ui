import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  try {
    // 获取环境变量中的 API key
    const apiKey = process.env.OPENAI_API_KEY || ""

    if (!apiKey) {
      return new NextResponse(
        JSON.stringify({
          error: "OpenAI API key not configured"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // 从请求中获取文本和可选配置
    const body = await req.json()
    const { text, voice = "alloy", model = "tts-1", speed = 1.0 } = body

    if (!text) {
      return new NextResponse(
        JSON.stringify({
          error: "No text provided"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // 验证 voice 参数
    const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    if (!validVoices.includes(voice)) {
      return new NextResponse(
        JSON.stringify({
          error: `Invalid voice. Must be one of: ${validVoices.join(", ")}`
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // 初始化 OpenAI 客户端
    const openai = new OpenAI({
      apiKey: apiKey
    })

    // 调用 TTS API 生成语音
    const mp3Response = await openai.audio.speech.create({
      model: model,
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text,
      speed: speed
    })

    // 将响应转换为 ArrayBuffer
    const audioBuffer = await mp3Response.arrayBuffer()

    // 返回音频流
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "no-cache"
      }
    })
  } catch (error: any) {
    console.error("Text-to-speech error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to generate speech",
        details: error.response?.data || null
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
