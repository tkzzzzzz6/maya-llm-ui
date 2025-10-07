import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    // 获取 YAYA 服务地址
    const yayaUrl = process.env.YAYA_SERVICE_URL || "http://localhost:5001"

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

    // 转发到 YAYA 服务
    const yayaFormData = new FormData()
    yayaFormData.append("audio", audioFile)

    const response = await fetch(`${yayaUrl}/api/speech-to-text`, {
      method: "POST",
      body: yayaFormData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "YAYA service error")
    }

    const result = await response.json()

    return new NextResponse(
      JSON.stringify({
        text: result.text,
        service: result.service || "YAYA"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (error: any) {
    console.error("YAYA Speech-to-text error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to transcribe audio with YAYA",
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
