"use client"

import { FC, useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  IconVideo,
  IconVideoOff,
  IconPlugConnected,
  IconPlugConnectedX
} from "@tabler/icons-react"
import { useVideoRealtime } from "./chat-hooks/use-video-realtime"
import { cn } from "@/lib/utils"

interface VideoChatRealtimeUIProps {
  onResponse?: (text: string) => void
}

export const VideoChatRealtimeUI: FC<VideoChatRealtimeUIProps> = ({
  onResponse
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [streamActive, setStreamActive] = useState(false)

  const {
    isConnected,
    isStreaming,
    currentResponse,
    currentTranscript,
    connect,
    disconnect,
    startStreaming,
    stopStreaming
  } = useVideoRealtime({
    onResponse: text => {
      console.log("收到响应:", text)
      onResponse?.(text)
    }
  })

  // 显示本地视频预览
  useEffect(() => {
    if (isStreaming && videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: "user" },
          audio: true
        })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            setStreamActive(true)
          }
        })
        .catch(err => {
          console.error("无法获取视频流:", err)
        })
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
        setStreamActive(false)
      }
    }
  }, [isStreaming])

  return (
    <div className="flex size-full flex-col">
      {/* 视频预览 */}
      <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn("size-full object-cover", !streamActive && "hidden")}
        />

        {!streamActive && (
          <div className="flex size-full flex-col items-center justify-center">
            <IconVideo size={64} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              {isConnected ? "点击开始视频流" : "请先连接服务"}
            </p>
          </div>
        )}

        {/* 状态指示器 */}
        {isStreaming && (
          <div className="absolute left-4 top-4 flex items-center space-x-2">
            <div className="size-3 animate-pulse rounded-full bg-red-500" />
            <span className="rounded-md bg-black/50 px-2 py-1 text-sm text-white">
              实时传输中
            </span>
          </div>
        )}
      </div>

      {/* 控制按钮 */}
      <div className="mt-4 flex items-center justify-center space-x-4">
        {!isConnected ? (
          <Button onClick={() => connect()} size="lg" className="w-40">
            <IconPlugConnected className="mr-2" size={20} />
            连接服务
          </Button>
        ) : (
          <>
            <Button
              onClick={() => disconnect()}
              variant="outline"
              size="lg"
              className="w-40"
            >
              <IconPlugConnectedX className="mr-2" size={20} />
              断开连接
            </Button>

            {!isStreaming ? (
              <Button
                onClick={() => startStreaming()}
                size="lg"
                className="w-40"
              >
                <IconVideo className="mr-2" size={20} />
                开始视频流
              </Button>
            ) : (
              <Button
                onClick={() => stopStreaming()}
                variant="destructive"
                size="lg"
                className="w-40"
              >
                <IconVideoOff className="mr-2" size={20} />
                停止视频流
              </Button>
            )}
          </>
        )}
      </div>

      {/* 响应显示 */}
      <div className="mt-4 space-y-2">
        {currentTranscript && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              语音转录:
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              {currentTranscript}
            </p>
          </div>
        )}

        {currentResponse && (
          <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              AI 响应:
            </p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              {currentResponse}
            </p>
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="text-muted-foreground mt-4 text-center text-xs">
        <p>🎤 实时模式：AI 会自动检测语音开始和结束</p>
        <p>📹 视频帧每 0.5 秒发送一次（2fps）</p>
      </div>
    </div>
  )
}
