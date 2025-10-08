import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    console.log("[Video API] 收到视频分析请求")

    // 获取 Qwen Video 服务地址
    const qwenVideoUrl =
      process.env.QWEN_VIDEO_SERVICE_URL || "http://localhost:5002"

    console.log("[Video API] Qwen Video 服务地址:", qwenVideoUrl)

    // 从请求中获取视频和音频数据
    const formData = await req.formData()
    const videoFile = formData.get("video") as File | null
    const audioFile = formData.get("audio") as File | null
    const question = formData.get("question") as string | null

    console.log("[Video API] 收到文件:", {
      video: videoFile
        ? { name: videoFile.name, size: videoFile.size, type: videoFile.type }
        : null,
      audio: audioFile
        ? { name: audioFile.name, size: audioFile.size, type: audioFile.type }
        : null,
      question
    })

    if (!videoFile) {
      console.error("[Video API] 未提供视频文件")
      return new NextResponse(
        JSON.stringify({
          error: "No video file provided"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // 转发到 Qwen Video 服务
    const qwenFormData = new FormData()
    qwenFormData.append("video", videoFile)
    if (audioFile) {
      qwenFormData.append("audio", audioFile)
    }
    if (question) {
      qwenFormData.append("question", question)
    }

    console.log("[Video API] 转发请求到:", `${qwenVideoUrl}/api/analyze-video`)

    const response = await fetch(`${qwenVideoUrl}/api/analyze-video`, {
      method: "POST",
      body: qwenFormData
    })

    console.log("[Video API] Qwen Video 服务响应状态:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Video API] Qwen Video 服务错误:", errorText)

      let error
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { error: errorText }
      }

      throw new Error(error.error || "Qwen Video service error")
    }

    const result = await response.json()
    console.log("[Video API] 分析结果:", result)

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("[Video API] 视频分析错误:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to analyze video",
        details:
          "请确保 Qwen Video 服务运行在 " +
          (process.env.QWEN_VIDEO_SERVICE_URL || "http://localhost:5002")
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
