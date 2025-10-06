"use client"

import { FC, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface VoiceVisualizerProps {
  analyserNode: AnalyserNode | null
  isActive: boolean
  mode?: "recording" | "playing"
  className?: string
}

export const VoiceVisualizer: FC<VoiceVisualizerProps> = ({
  analyserNode,
  isActive,
  mode = "recording",
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !analyserNode || !isActive) {
      // 停止动画
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // 清空画布
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }

      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // 设置 canvas 尺寸
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      ctx.scale(dpr, dpr)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // 获取频率数据
    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    // 绘制波形
    const draw = () => {
      if (!isActive) return

      animationFrameRef.current = requestAnimationFrame(draw)

      analyserNode.getByteTimeDomainData(dataArray)

      const width = canvas.width / (window.devicePixelRatio || 1)
      const height = canvas.height / (window.devicePixelRatio || 1)

      // 清空画布
      ctx.fillStyle = mode === "recording" ? "rgb(17, 24, 39)" : "rgb(30, 41, 59)"
      ctx.fillRect(0, 0, width, height)

      // 绘制波形线
      ctx.lineWidth = 2
      ctx.strokeStyle = mode === "recording" ? "rgb(34, 197, 94)" : "rgb(59, 130, 246)"
      ctx.beginPath()

      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.lineTo(width, height / 2)
      ctx.stroke()
    }

    draw()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [analyserNode, isActive, mode])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2",
        mode === "recording"
          ? "border-green-500 bg-gray-900"
          : "border-blue-500 bg-slate-800",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: "block" }}
      />

      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">
            {mode === "recording" ? "等待录音..." : "等待播放..."}
          </div>
        </div>
      )}
    </div>
  )
}
