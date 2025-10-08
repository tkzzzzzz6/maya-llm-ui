import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"

export interface VideoDevice {
  deviceId: string
  label: string
}

export interface VideoHandlerReturn {
  // 录制状态
  isRecording: boolean
  isPaused: boolean
  recordingDuration: number
  previewStream: MediaStream | null

  // 摄像头设备
  videoDevices: VideoDevice[]
  selectedDeviceId: string | null
  setSelectedDeviceId: (deviceId: string) => void
  loadVideoDevices: () => Promise<void>

  // 录制控制
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void

  // 截图功能
  captureFrame: () => Promise<Blob | null>
}

interface VideoHandlerOptions {
  onRecordingComplete?: (videoBlob: Blob, imageBlob?: Blob) => void
  onError?: (error: Error) => void
}

export function useVideoHandler(
  options?: VideoHandlerOptions
): VideoHandlerReturn {
  // 录制相关状态
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)

  // 摄像头设备状态
  const [videoDevices, setVideoDevices] = useState<VideoDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)

  // 获取可用的摄像头设备
  const loadVideoDevices = useCallback(async () => {
    try {
      // 先请求一次权限，这样才能获取到设备标签
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true
      })
      tempStream.getTracks().forEach(track => track.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices
        .filter(device => device.kind === "videoinput")
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `摄像头 ${device.deviceId.slice(0, 5)}`
        }))

      setVideoDevices(videoInputs)

      // 如果还没选择设备，默认选择第一个
      if (!selectedDeviceId && videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId)
      }

      console.log("可用的摄像头设备:", videoInputs)
    } catch (error) {
      console.error("Failed to load video devices:", error)
    }
  }, [selectedDeviceId])

  // 组件挂载时自动加载摄像头列表
  useEffect(() => {
    loadVideoDevices()
  }, [])

  // 开始录制
  const startRecording = useCallback(async () => {
    try {
      // 如果设备列表为空，先加载
      if (videoDevices.length === 0) {
        await loadVideoDevices()
      }

      if (videoDevices.length === 0) {
        toast.error("未检测到可用的摄像头设备")
        return
      }

      // 构建视频约束
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }

      // 如果用户选择了特定的摄像头，使用 deviceId
      if (selectedDeviceId) {
        videoConstraints.deviceId = { exact: selectedDeviceId }
      } else {
        videoConstraints.facingMode = "user" // 前置摄像头
      }

      // 请求摄像头和麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream
      setPreviewStream(stream)

      // 创建 MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4"

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      })

      mediaRecorderRef.current = mediaRecorder
      videoChunksRef.current = []

      // 监听数据可用事件
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data)
        }
      }

      // 监听停止事件
      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunksRef.current, {
          type: mimeType
        })

        // 可选：捕获最后一帧作为缩略图
        const imageBlob = await captureFrameFromStream()

        options?.onRecordingComplete?.(videoBlob, imageBlob || undefined)

        // 清理
        cleanup()
      }

      // 开始录制
      mediaRecorder.start(1000) // 每秒收集一次数据
      setIsRecording(true)
      setIsPaused(false)

      // 开始计时
      let duration = 0
      durationIntervalRef.current = setInterval(() => {
        duration += 1
        setRecordingDuration(duration)
      }, 1000)

      toast.success("开始视频录制")
    } catch (error: any) {
      console.error("Failed to start video recording:", error)
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        constraint: error.constraint
      })

      if (error.name === "NotAllowedError") {
        toast.error("摄像头或麦克风权限被拒绝，请在浏览器设置中允许访问")
      } else if (error.name === "NotFoundError") {
        toast.error("未找到摄像头或麦克风设备")
      } else if (error.name === "NotReadableError") {
        toast.error(
          "摄像头被占用或无法访问，请关闭其他使用摄像头的程序（如 Iriun Webcam、Zoom、Teams 等）"
        )
      } else if (error.name === "OverconstrainedError") {
        toast.error("所选摄像头不支持请求的配置，请尝试选择其他摄像头")
      } else {
        toast.error(`无法访问摄像头: ${error.message}`)
      }
      options?.onError?.(error)
    }
  }, [options, videoDevices, loadVideoDevices, selectedDeviceId])

  // 停止录制
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

  // 暂停录制
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)

      // 暂停计时
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }

      toast.info("视频录制已暂停")
    }
  }, [isRecording, isPaused])

  // 恢复录制
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

      toast.info("继续录制")
    }
  }, [isRecording, isPaused, recordingDuration])

  // 取消录制
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }

    cleanup()
    setIsRecording(false)
    setIsPaused(false)
    setRecordingDuration(0)

    toast.info("已取消录制")
  }, [])

  // 清理资源
  const cleanup = useCallback(() => {
    // 停止所有轨道
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // 清空预览流
    setPreviewStream(null)

    // 清空录制数据
    videoChunksRef.current = []

    // 重置时长
    setRecordingDuration(0)

    // 清除计时器
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }, [])

  // 从流中捕获一帧
  const captureFrameFromStream = useCallback(async (): Promise<Blob | null> => {
    if (!streamRef.current) return null

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (!videoTrack) return null

      // @ts-ignore - ImageCapture API 可能不在所有类型定义中
      const imageCapture = new ImageCapture(videoTrack)
      const bitmap = await imageCapture.grabFrame()

      // 创建 canvas 并绘制帧
      const canvas = document.createElement("canvas")
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(bitmap, 0, 0)

      // 转换为 Blob
      return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.9)
      })
    } catch (error) {
      console.error("Failed to capture frame:", error)
      return null
    }
  }, [])

  // 手动截图
  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    return captureFrameFromStream()
  }, [captureFrameFromStream])

  return {
    isRecording,
    isPaused,
    recordingDuration,
    previewStream,
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    loadVideoDevices,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    captureFrame
  }
}
