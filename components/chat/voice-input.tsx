"use client"

import { FC } from "react"
import { cn } from "@/lib/utils"
import {
  IconMicrophone,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconX
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  VoiceHandlerReturn,
  VoiceProvider
} from "./chat-hooks/use-voice-handler"
import { VoiceVisualizer } from "./voice-visualizer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"

interface VoiceInputProps {
  voiceHandler: VoiceHandlerReturn
  onSendMessage?: (text: string) => void
  className?: string
}

export const VoiceInput: FC<VoiceInputProps> = ({
  voiceHandler,
  onSendMessage,
  className
}) => {
  const {
    isRecording,
    isPaused,
    recordingDuration,
    isPlaying,
    provider,
    setProvider,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    pauseAudio,
    resumeAudio,
    stopAudio,
    analyserNode
  } = voiceHandler

  // 格式化录音时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className={cn("flex w-full flex-col space-y-4", className)}>
      {/* 语音服务提供商选择器 */}
      <div className="flex items-center justify-center space-x-3">
        <span className="text-muted-foreground text-sm">语音服务:</span>
        <Select
          value={provider}
          onValueChange={(value: VoiceProvider) => setProvider(value)}
          disabled={isRecording || isPlaying}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="google">Google Cloud</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 波形可视化 */}
      <VoiceVisualizer
        analyserNode={analyserNode}
        isActive={isRecording || isPlaying}
        mode={isRecording ? "recording" : "playing"}
        className="h-32 w-full"
      />

      {/* 录音时长显示 */}
      {isRecording && (
        <div className="flex items-center justify-center space-x-2">
          <div
            className={cn(
              "size-3 rounded-full",
              isPaused ? "bg-yellow-500" : "animate-pulse bg-red-500"
            )}
          />
          <div className="text-lg font-mono font-semibold">
            {formatDuration(recordingDuration)}
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="flex items-center justify-center space-x-3">
        {!isRecording && !isPlaying && (
          // 开始录音按钮
          <Button
            onClick={startRecording}
            size="lg"
            className="bg-primary hover:bg-primary/90 h-20 w-20 rounded-full"
          >
            <IconMicrophone size={32} />
          </Button>
        )}

        {isRecording && (
          <>
            {/* 暂停/继续按钮 */}
            <Button
              onClick={isPaused ? resumeRecording : pauseRecording}
              size="lg"
              variant="outline"
              className="h-16 w-16 rounded-full"
            >
              {isPaused ? (
                <IconPlayerPlay size={28} />
              ) : (
                <IconPlayerPause size={28} />
              )}
            </Button>

            {/* 停止录音按钮 */}
            <Button
              onClick={stopRecording}
              size="lg"
              className="h-20 w-20 rounded-full bg-red-600 hover:bg-red-700"
            >
              <IconPlayerStop size={32} />
            </Button>

            {/* 取消录音按钮 */}
            <Button
              onClick={cancelRecording}
              size="lg"
              variant="outline"
              className="h-16 w-16 rounded-full"
            >
              <IconX size={28} />
            </Button>
          </>
        )}

        {isPlaying && (
          <>
            {/* 暂停/继续播放按钮 */}
            <Button
              onClick={pauseAudio}
              size="lg"
              variant="outline"
              className="h-16 w-16 rounded-full"
            >
              <IconPlayerPause size={28} />
            </Button>

            {/* 停止播放按钮 */}
            <Button
              onClick={stopAudio}
              size="lg"
              className="h-16 w-16 rounded-full bg-blue-600 hover:bg-blue-700"
            >
              <IconPlayerStop size={28} />
            </Button>
          </>
        )}
      </div>

      {/* 提示文本 */}
      <div className="text-muted-foreground text-center text-sm">
        {!isRecording && !isPlaying && "点击麦克风开始录音"}
        {isRecording && !isPaused && "正在录音..."}
        {isRecording && isPaused && "录音已暂停"}
        {isPlaying && "正在播放 AI 回复"}
      </div>
    </div>
  )
}
