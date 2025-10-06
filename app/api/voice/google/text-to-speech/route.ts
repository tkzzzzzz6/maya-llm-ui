import { NextRequest, NextResponse } from "next/server"
import { TextToSpeechClient } from "@google-cloud/text-to-speech"

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

    // 从请求中获取文本和可选配置
    const body = await req.json()
    const {
      text,
      languageCode = "zh-CN",
      voiceName = "zh-CN-Neural2-D",
      speakingRate = 1.0,
      pitch = 0.0,
      volumeGainDb = 0.0
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

    // 初始化 Google Text-to-Speech 客户端
    const client = new TextToSpeechClient({
      ...(apiKey ? { apiKey } : {}),
      ...(credentialsPath ? { keyFilename: credentialsPath } : {})
    })

    // 配置 TTS 请求
    const request = {
      input: { text: text },
      voice: {
        languageCode: languageCode,
        name: voiceName
      },
      audioConfig: {
        audioEncoding: "MP3" as const,
        speakingRate: speakingRate,
        pitch: pitch,
        volumeGainDb: volumeGainDb
      }
    }

    // 调用 Google Text-to-Speech API
    const [response] = await client.synthesizeSpeech(request)

    if (!response.audioContent) {
      return new NextResponse(
        JSON.stringify({
          error: "No audio content generated"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // 将音频内容转换为 Buffer
    const audioBuffer =
      response.audioContent instanceof Buffer
        ? response.audioContent
        : Buffer.from(response.audioContent)

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
    console.error("Google Text-to-speech error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to generate speech",
        details: error.details || null
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
