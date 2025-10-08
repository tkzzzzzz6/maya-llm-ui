import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * 创建视频分析会话
 */
export async function POST(req: NextRequest) {
  try {
    const qwenVideoUrl =
      process.env.QWEN_VIDEO_SERVICE_URL || "http://localhost:5002"

    const body = await req.json()
    const { instructions } = body

    const response = await fetch(`${qwenVideoUrl}/api/session/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ instructions })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create session")
    }

    const result = await response.json()

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("Session creation error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to create session"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}

/**
 * 关闭视频分析会话
 */
export async function DELETE(req: NextRequest) {
  try {
    const qwenVideoUrl =
      process.env.QWEN_VIDEO_SERVICE_URL || "http://localhost:5002"

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return new NextResponse(
        JSON.stringify({ error: "Session ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    const response = await fetch(
      `${qwenVideoUrl}/api/session/${sessionId}/close`,
      {
        method: "POST"
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to close session")
    }

    const result = await response.json()

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("Session close error:", error)

    return new NextResponse(
      JSON.stringify({
        error: error.message || "Failed to close session"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
