import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    // 获取 YAYA 服务地址
    const YAYAUrl = process.env.YAYA_SERVICE_URL || "http://localhost:5001"

    // 从请求中获取文本和可选配置
    const body = await req.json()
    const {
      text,
      voice = "zh-CN-XiaoxiaoNeural", // 默认使用晓晓女声
      rate = "+0%",
      pitch = "+0Hz"
    } = body

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

    // 调用 YAYA TTS API
    const response = await fetch(`${YAYAUrl}/api/text-to-speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        voice,
        rate,
        pitch
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "YAYA TTS service error")
    }

    // 获取音频数据
    const audioBuffer = await response.arrayBuffer()

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
    console.error("YAYA Text-to-speech error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to generate speech with YAYA",
        details:
          "请确保 YAYA 服务运行在 " +
          (process.env.YAYA_SERVICE_URL || "http://localhost:5001")
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
