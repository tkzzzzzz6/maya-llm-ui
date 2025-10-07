import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

// 代理所有 Ollama 请求
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const path = url.searchParams.get("path") || "/api/tags"
    
    const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"
    
    const response = await fetch(`${ollamaUrl}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Ollama server is not responding" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error proxying Ollama request:", error)
    return NextResponse.json(
      { error: error.message || "Failed to connect to Ollama" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"
    
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Ollama server is not responding" },
        { status: response.status }
      )
    }

    // 返回流式响应
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    })
  } catch (error: any) {
    console.error("Error proxying Ollama chat request:", error)
    return NextResponse.json(
      { error: error.message || "Failed to connect to Ollama" },
      { status: 500 }
    )
  }
}

