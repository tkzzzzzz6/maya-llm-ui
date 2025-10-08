"use client"

import { FC, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  IconVideo,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
  IconCamera
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { VideoHandlerReturn } from "./chat-hooks/use-video-handler"

interface VideoInputProps {
  videoHandler: VideoHandlerReturn
  onSendVideo?: (videoBlob: Blob, imageBlob?: Blob) => void
  className?: string
}

export const VideoInput: FC<VideoInputProps> = ({
  videoHandler,
  onSendVideo,
  className
}) => {
  const {
    isRecording,
    isPaused,
    recordingDuration,
    previewStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    captureFrame
  } = videoHandler

  const videoRef = useRef<HTMLVideoElement>(null)

  // 将预览流绑定到 video 元素
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream
      videoRef.current.play()
    }
  }, [previewStream])

  // 格式化录制时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // 处理截图
  const handleCapture = async () => {
    const imageBlob = await captureFrame()
    if (imageBlob) {
      // 可以在这里处理截图，比如显示预览或上传
      console.log("Captured frame:", imageBlob)
    }
  }

  return (
    <div className={cn("flex w-full flex-col space-y-4", className)}>
      {/* 视频预览区域 */}
      <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg">
        {previewStream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="size-full object-cover"
            />
            {/* 录制指示器 */}
            {isRecording && (
              <div className="absolute left-4 top-4 flex items-center space-x-2">
                <div
                  className={cn(
                    "size-3 rounded-full",
                    isPaused ? "bg-yellow-500" : "animate-pulse bg-red-500"
                  )}
                />
                <span className="rounded-md bg-black/50 px-2 py-1 font-mono text-sm text-white">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
            )}
            {/* 截图按钮 */}
            {isRecording && (
              <div className="absolute bottom-4 right-4">
                <Button
                  onClick={handleCapture}
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                >
                  <IconCamera size={20} className="mr-2" />
                  截图
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center space-y-2">
            <IconVideo size={64} className="text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              点击下方按钮开始视频录制
            </p>
          </div>
        )}
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center space-x-3">
        {!isRecording && (
          // 开始录制按钮
          <Button
            onClick={startRecording}
            size="lg"
            className="bg-primary hover:bg-primary/90 size-20 rounded-full"
          >
            <IconVideo size={32} />
          </Button>
        )}

        {isRecording && (
          <>
            {/* 暂停/继续按钮 */}
            <Button
              onClick={isPaused ? resumeRecording : pauseRecording}
              size="lg"
              variant="outline"
              className="size-16 rounded-full"
            >
              {isPaused ? (
                <IconPlayerPlay size={28} />
              ) : (
                <IconPlayerPause size={28} />
              )}
            </Button>

            {/* 停止录制按钮 */}
            <Button
              onClick={stopRecording}
              size="lg"
              className="size-20 rounded-full bg-red-600 hover:bg-red-700"
            >
              <IconPlayerStop size={32} />
            </Button>

            {/* 取消录制按钮 */}
            <Button
              onClick={cancelRecording}
              size="lg"
              variant="outline"
              className="size-16 rounded-full"
            >
              <IconX size={28} />
            </Button>
          </>
        )}
      </div>

      {/* 提示文本 */}
      <div className="text-muted-foreground text-center text-sm">
        {!isRecording && "点击摄像头图标开始视频录制"}
        {isRecording && !isPaused && "正在录制视频..."}
        {isRecording && isPaused && "视频录制已暂停"}
      </div>
    </div>
  )
}
