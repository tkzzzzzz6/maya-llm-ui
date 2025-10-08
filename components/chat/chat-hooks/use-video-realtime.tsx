import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"

export interface VideoRealtimeHandlerReturn {
  // 状态
  isConnected: boolean
  isStreaming: boolean
  currentResponse: string
  currentTranscript: string
  availableCameras: MediaDeviceInfo[]
  selectedCameraId: string | null

  // 控制
  connect: () => Promise<void>
  disconnect: () => void
  startStreaming: (cameraId?: string) => Promise<void>
  stopStreaming: () => void
  selectCamera: (deviceId: string) => void
  refreshCameras: () => Promise<void>

  // 回调
  onResponse?: (text: string) => void
  onAudio?: (audioBlob: Blob) => void
}

interface VideoRealtimeHandlerOptions {
  onResponse?: (text: string) => void
  onAudio?: (audioBlob: Blob) => void
  onError?: (error: Error) => void
}

export function useVideoRealtime(
  options?: VideoRealtimeHandlerOptions
): VideoRealtimeHandlerReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState("")
  const [currentTranscript, setCurrentTranscript] = useState("")

  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null)

  // 连接 WebSocket
  const connect = useCallback(async () => {
    try {
      // 获取 WebSocket URL - 支持多种方式
      let wsUrl = process.env.NEXT_PUBLIC_QWEN_VIDEO_WS_URL

      console.log("🔍 环境变量:", process.env.NEXT_PUBLIC_QWEN_VIDEO_WS_URL)
      console.log("🌐 当前主机:", window.location.hostname)

      if (!wsUrl) {
        // 如果没有配置环境变量，使用当前页面的主机名
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
        const hostname = window.location.hostname
        // 默认使用 5003 端口
        wsUrl = `${protocol}//${hostname}:5003/ws/video`
        console.log("⚠️ 未找到环境变量，使用自动生成地址")
      } else {
        console.log("✅ 使用环境变量配置的地址")
      }

      console.log("📡 连接到实时视频服务:", wsUrl)

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log("WebSocket 连接成功")
        setIsConnected(true)
        toast.success("实时视频服务已连接")
      }

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case "ready":
              console.log("会话已就绪:", data.session_id)
              break

            case "text.delta":
              // 接收文本响应
              setCurrentResponse(prev => prev + data.text)
              options?.onResponse?.(data.text)
              break

            case "audio.delta":
              // 接收音频响应
              if (data.audio) {
                const audioBlob = base64ToBlob(data.audio, "audio/pcm")
                options?.onAudio?.(audioBlob)
              }
              break

            case "transcript":
              // 语音转录
              setCurrentTranscript(data.text)
              console.log("语音转录:", data.text)
              break

            case "speech.started":
              console.log("检测到语音开始")
              break

            case "response.done":
              console.log("响应完成")
              break

            case "error":
              console.error("服务器错误:", data.message)
              toast.error(data.message)
              break
          }
        } catch (error) {
          console.error("解析消息失败:", error)
        }
      }

      ws.onerror = error => {
        console.error("WebSocket 错误:", error)
        toast.error("实时视频服务连接错误")
        const errorObj = new Error("WebSocket connection error")
        options?.onError?.(errorObj)
      }

      ws.onclose = () => {
        console.log("WebSocket 连接关闭")
        setIsConnected(false)
        setIsStreaming(false)
      }

      wsRef.current = ws
    } catch (error: any) {
      console.error("连接失败:", error)
      toast.error("无法连接到实时视频服务")
      options?.onError?.(error)
    }
  }, [options])

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "close" }))
      wsRef.current.close()
      wsRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current)
      videoIntervalRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsConnected(false)
    setIsStreaming(false)
  }, [])

  // 开始流式传输
  const startStreaming = useCallback(async () => {
    if (!isConnected || !wsRef.current) {
      toast.error("请先连接服务")
      return
    }

    try {
      // 获取摄像头和麦克风
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      })

      streamRef.current = stream
      setIsStreaming(true)

      // 定时发送视频帧（2fps）
      const videoTrack = stream.getVideoTracks()[0]
      // @ts-ignore - ImageCapture API 可能不在所有类型定义中
      const imageCapture = new ImageCapture(videoTrack)

      videoIntervalRef.current = setInterval(async () => {
        try {
          // @ts-ignore - grabFrame 方法类型定义
          const bitmap = await imageCapture.grabFrame()

          // 转换为 JPEG
          const canvas = document.createElement("canvas")
          canvas.width = bitmap.width
          canvas.height = bitmap.height
          const ctx = canvas.getContext("2d")
          ctx?.drawImage(bitmap, 0, 0)

          canvas.toBlob(
            blob => {
              if (blob && wsRef.current) {
                const reader = new FileReader()
                reader.onload = () => {
                  const base64 = (reader.result as string).split(",")[1]
                  wsRef.current?.send(
                    JSON.stringify({
                      type: "video",
                      data: base64
                    })
                  )
                }
                reader.readAsDataURL(blob)
              }
            },
            "image/jpeg",
            0.7
          )
        } catch (error) {
          console.error("捕获视频帧失败:", error)
        }
      }, 500) // 2fps

      // 实时发送音频
      const audioTrack = stream.getAudioTracks()[0]
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(
        new MediaStream([audioTrack])
      )

      // 使用 ScriptProcessorNode 处理音频（简化版）
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = e => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0)

          // 转换为 16-bit PCM
          const pcm = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }

          // 转为 Base64
          const base64 = arrayBufferToBase64(pcm.buffer)

          wsRef.current.send(
            JSON.stringify({
              type: "audio",
              data: base64
            })
          )
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      toast.success("开始实时流式传输")
    } catch (error: any) {
      console.error("开始流式传输失败:", error)
      toast.error("无法访问摄像头或麦克风")
      options?.onError?.(error)
    }
  }, [isConnected, options])

  // 停止流式传输
  const stopStreaming = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current)
      videoIntervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsStreaming(false)
    toast.info("停止流式传输")
  }, [])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    isStreaming,
    currentResponse,
    currentTranscript,
    availableCameras: [], // TODO: 实现摄像头管理
    selectedCameraId: null,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    selectCamera: (deviceId: string) => {}, // TODO: 实现摄像头选择
    refreshCameras: async () => {}, // TODO: 实现刷新摄像头
    onResponse: options?.onResponse,
    onAudio: options?.onAudio
  }
}

// 工具函数
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
