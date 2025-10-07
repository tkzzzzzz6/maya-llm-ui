import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"

export type VoiceProvider = "openai" | "google" | "yaya"

interface VoiceHandlerOptions {
  onTranscriptionComplete?: (text: string) => void
  onError?: (error: Error) => void
  provider?: VoiceProvider
}

export interface VoiceHandlerReturn {
  // 录音状态
  isRecording: boolean
  isPaused: boolean
  recordingDuration: number

  // TTS 播放状态
  isPlaying: boolean
  currentAudio: HTMLAudioElement | null

  // 提供商状态
  provider: VoiceProvider
  setProvider: (provider: VoiceProvider) => void

  // 录音控制
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void

  // TTS 控制
  playTextToSpeech: (text: string, options?: TTSOptions) => Promise<void>
  pauseAudio: () => void
  resumeAudio: () => void
  stopAudio: () => void

  // 音频分析
  analyserNode: AnalyserNode | null
  audioContext: AudioContext | null
}

interface OpenAITTSOptions {
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  model?: "tts-1" | "tts-1-hd"
  speed?: number
}

interface GoogleTTSOptions {
  languageCode?: string
  voiceName?: string
  speakingRate?: number
  pitch?: number
  volumeGainDb?: number
}

type TTSOptions = OpenAITTSOptions | GoogleTTSOptions

export function useVoiceHandler(
  options?: VoiceHandlerOptions
): VoiceHandlerReturn {
  // 提供商状态
  const [provider, setProvider] = useState<VoiceProvider>(
    options?.provider || "openai"
  )

  // 录音相关状态
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  // TTS 播放状态
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(
    null
  )

  // 音频分析
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream

      // 创建 AudioContext 用于音频分析
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)

      setAudioContext(context)
      setAnalyserNode(analyser)

      // 创建 MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4"

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // 监听数据可用事件
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // 监听停止事件
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType
        })

        // 发送到 STT API
        await transcribeAudio(audioBlob)

        // 清理
        cleanup()
      }

      // 开始录音
      mediaRecorder.start(1000) // 每秒收集一次数据
      setIsRecording(true)
      setIsPaused(false)

      // 开始计时
      let duration = 0
      durationIntervalRef.current = setInterval(() => {
        duration += 1
        setRecordingDuration(duration)
      }, 1000)

      toast.success("开始录音")
    } catch (error: any) {
      console.error("Failed to start recording:", error)
      toast.error("无法访问麦克风，请检查权限设置")
      options?.onError?.(error)
    }
  }, [options])

  // 停止录音
  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)

      // 停止计时
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }
  }, [isRecording])

  // 暂停录音
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)

      // 暂停计时
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }

      toast.info("录音已暂停")
    }
  }, [isRecording, isPaused])

  // 恢复录音
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)

      // 恢复计时
      let currentDuration = recordingDuration
      durationIntervalRef.current = setInterval(() => {
        currentDuration += 1
        setRecordingDuration(currentDuration)
      }, 1000)

      toast.info("继续录音")
    }
  }, [isRecording, isPaused, recordingDuration])

  // 取消录音
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      audioChunksRef.current = []
      cleanup()
      toast.info("录音已取消")
    }
  }, [])

  // 转录音频
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      toast.loading("正在转换语音...", { id: "transcribing" })

      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")

      // 根据提供商选择不同的 API 端点
      let endpoint: string
      if (provider === "google") {
        endpoint = "/api/voice/google/speech-to-text"
      } else if (provider === "yaya") {
        endpoint = "/api/voice/yaya/speech-to-text"
      } else {
        endpoint = "/api/voice/speech-to-text"
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        throw new Error("Failed to transcribe audio")
      }

      const data = await response.json()
      const text = data.text

      toast.success("语音转换成功", { id: "transcribing" })
      options?.onTranscriptionComplete?.(text)

      return text
    } catch (error: any) {
      console.error("Transcription error:", error)
      toast.error("语音转换失败", { id: "transcribing" })
      options?.onError?.(error)
    }
  }

  // 播放 TTS
  const playTextToSpeech = useCallback(
    async (text: string, ttsOptions?: TTSOptions) => {
      try {
        // 停止当前播放
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.src = ""
        }

        toast.loading("正在生成语音...", { id: "tts" })

        // 根据提供商选择不同的 API 端点和参数
        let endpoint: string
        let body: any

        if (provider === "google") {
          endpoint = "/api/voice/google/text-to-speech"
          const googleOptions = ttsOptions as GoogleTTSOptions | undefined
          body = {
            text,
            languageCode: googleOptions?.languageCode || "zh-CN",
            voiceName: googleOptions?.voiceName || "zh-CN-Neural2-D",
            speakingRate: googleOptions?.speakingRate || 1.0,
            pitch: googleOptions?.pitch || 0.0,
            volumeGainDb: googleOptions?.volumeGainDb || 0.0
          }
        } else if (provider === "yaya") {
          endpoint = "/api/voice/yaya/text-to-speech"
          body = {
            text,
            voice: "zh-CN-XiaoxiaoNeural", // YAYA 默认使用晓晓女声
            rate: "+0%",
            pitch: "+0Hz"
          }
        } else {
          endpoint = "/api/voice/text-to-speech"
          const openaiOptions = ttsOptions as OpenAITTSOptions | undefined
          body = {
            text,
            voice: openaiOptions?.voice || "alloy",
            model: openaiOptions?.model || "tts-1",
            speed: openaiOptions?.speed || 1.0
          }
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        })

        if (!response.ok) {
          throw new Error("Failed to generate speech")
        }

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        const audio = new Audio(audioUrl)
        setCurrentAudio(audio)

        audio.onplay = () => {
          setIsPlaying(true)
          toast.success("开始播放", { id: "tts" })
        }

        audio.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(audioUrl)
        }

        audio.onerror = () => {
          setIsPlaying(false)
          toast.error("播放失败", { id: "tts" })
        }

        await audio.play()
      } catch (error: any) {
        console.error("TTS error:", error)
        toast.error("语音生成失败", { id: "tts" })
        options?.onError?.(error)
      }
    },
    [currentAudio, options, provider]
  )

  // 暂停播放
  const pauseAudio = useCallback(() => {
    if (currentAudio && isPlaying) {
      currentAudio.pause()
      setIsPlaying(false)
    }
  }, [currentAudio, isPlaying])

  // 恢复播放
  const resumeAudio = useCallback(() => {
    if (currentAudio && !isPlaying) {
      currentAudio.play()
      setIsPlaying(true)
    }
  }, [currentAudio, isPlaying])

  // 停止播放
  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setIsPlaying(false)
    }
  }, [currentAudio])

  // 清理资源
  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContext) {
      audioContext.close()
      setAudioContext(null)
    }

    setAnalyserNode(null)
    setIsRecording(false)
    setIsPaused(false)
    setRecordingDuration(0)

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }

  return {
    isRecording,
    isPaused,
    recordingDuration,
    isPlaying,
    currentAudio,
    provider,
    setProvider,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    playTextToSpeech,
    pauseAudio,
    resumeAudio,
    stopAudio,
    analyserNode,
    audioContext
  }
}
