import { NextRequest, NextResponse } from "next/server"
import { SpeechClient } from "@google-cloud/speech"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    // 获取环境变量中的 API key 或凭证
    const apiKey = process.env.GOOGLE_API_KEY || ""
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || ""

    if (!apiKey && !credentialsPath) {
      return new NextResponse(
        JSON.stringify({
          error: "Google Cloud credentials not configured"
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
    const language = (formData.get("language") as string) || "zh-CN"

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

    // 读取音频文件为 Buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioBytes = Buffer.from(arrayBuffer)

    // 初始化 Google Speech 客户端
    const client = new SpeechClient({
      ...(apiKey ? { apiKey } : {}),
      ...(credentialsPath ? { keyFilename: credentialsPath } : {})
    })

    // 配置识别请求
    const audio = {
      content: audioBytes.toString("base64")
    }

    const config = {
      encoding: "WEBM_OPUS" as const,
      sampleRateHertz: 48000,
      languageCode: language,
      model: "latest_long", // 使用最新的长语音模型
      enableAutomaticPunctuation: true,
      useEnhanced: true
    }

    const request = {
      audio: audio,
      config: config
    }

    // 调用 Google Speech-to-Text API
    const [response] = await client.recognize(request)
    const transcription = response.results
      ?.map(result => result.alternatives?.[0]?.transcript)
      .join("\n")

    if (!transcription) {
      return new NextResponse(
        JSON.stringify({
          error: "No transcription result"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    return new NextResponse(
      JSON.stringify({
        text: transcription,
        confidence:
          response.results?.[0]?.alternatives?.[0]?.confidence || null
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (error: any) {
    console.error("Google Speech-to-text error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to transcribe audio",
        details: error.details || null
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
