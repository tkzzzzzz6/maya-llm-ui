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

    // 从请求中获取音频文件
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return new NextResponse(
        JSON.stringify({
          error: "No audio file provided"
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

    // 调用 Whisper API 进行语音转文字
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "zh", // 可以根据需要调整语言，或从请求参数中获取
      response_format: "json"
    })

    return new NextResponse(
      JSON.stringify({
        text: transcription.text
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (error: any) {
    console.error("Speech-to-text error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to transcribe audio",
        details: error.response?.data || null
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
