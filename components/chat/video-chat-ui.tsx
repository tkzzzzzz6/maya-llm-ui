"use client"

import Loading from "@/app/[locale]/loading"
import { ChatbotUIContext } from "@/context/context"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { getChatFilesByChatId } from "@/db/chat-files"
import { getChatById } from "@/db/chats"
import { getMessageFileItemsByMessageId } from "@/db/message-file-items"
import { getMessagesByChatId } from "@/db/messages"
import { getMessageImageFromStorage } from "@/db/storage/message-images"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, MessageImage } from "@/types"
import { useParams, useRouter } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { ChatHelp } from "./chat-help"
import { useScroll } from "./chat-hooks/use-scroll"
import { useChatHandler } from "./chat-hooks/use-chat-handler"
import { useVideoHandler } from "./chat-hooks/use-video-handler"
import { ChatMessages } from "./chat-messages"
import { ChatScrollButtons } from "./chat-scroll-buttons"
import { VideoInput } from "./video-input"
import { IconKeyboard } from "@tabler/icons-react"
import { WithTooltip } from "@/components/ui/with-tooltip"

interface VideoChatUIProps {}

export const VideoChatUI: FC<VideoChatUIProps> = ({}) => {
  const router = useRouter()
  const params = useParams()

  const {
    setChatMessages,
    selectedChat,
    setSelectedChat,
    setChatSettings,
    setChatImages,
    assistants,
    setSelectedAssistant,
    setChatFileItems,
    setChatFiles,
    setShowFilesDisplay,
    setUseRetrieval,
    setSelectedTools,
    chatMessages,
    userInput,
    setUserInput
  } = useContext(ChatbotUIContext)

  const { handleNewChat, handleSendMessage } = useChatHandler()

  const {
    messagesStartRef,
    messagesEndRef,
    handleScroll,
    scrollToBottom,
    setIsAtBottom,
    isAtTop,
    isAtBottom,
    isOverflowing,
    scrollToTop
  } = useScroll()

  const [loading, setLoading] = useState(true)

  // 视频处理 Hook
  const videoHandler = useVideoHandler({
    onRecordingComplete: async (videoBlob: Blob, imageBlob?: Blob) => {
      // 视频录制完成后，发送到 Qwen Video 服务进行分析
      try {
        console.log("视频录制完成", {
          videoSize: videoBlob.size,
          imageSize: imageBlob?.size
        })

        // 创建 FormData
        const formData = new FormData()
        formData.append("video", videoBlob, "recording.webm")
        formData.append("question", "请分析这个视频中的内容")

        // 发送到视频分析 API
        console.log("正在发送视频到服务器...")
        const response = await fetch("/api/video/analyze", {
          method: "POST",
          body: formData
        })

        console.log("服务器响应状态:", response.status)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error("服务器错误:", errorData)
          throw new Error(
            errorData.error || `视频分析失败 (${response.status})`
          )
        }

        const result = await response.json()
        console.log("视频分析结果:", result)

        // 将分析结果作为消息显示
        if (result.analysis) {
          setUserInput(`视频分析: ${result.analysis}`)
          await handleSendMessage(
            `[视频内容]: ${result.analysis}`,
            chatMessages,
            false
          )
        } else {
          console.warn("未收到分析结果")
        }
      } catch (error: any) {
        console.error("视频分析错误:", error)
        alert(`视频分析失败: ${error.message}`)
      }
    },
    onError: error => {
      console.error("Video error:", error)
    }
  })

  useHotkey("o", () => handleNewChat())

  useEffect(() => {
    const fetchData = async () => {
      await fetchMessages()
      await fetchChat()

      scrollToBottom()
      setIsAtBottom(true)
    }

    if (params.chatid) {
      fetchData().then(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const fetchMessages = async () => {
    const fetchedMessages = await getMessagesByChatId(params.chatid as string)

    const imagePromises: Promise<MessageImage>[] = fetchedMessages.flatMap(
      message =>
        message.image_paths
          ? message.image_paths.map(async imagePath => {
              const url = await getMessageImageFromStorage(imagePath)

              if (url) {
                const response = await fetch(url)
                const blob = await response.blob()
                const base64 = await convertBlobToBase64(blob)

                return {
                  messageId: message.id,
                  path: imagePath,
                  base64,
                  url,
                  file: null
                }
              }

              return {
                messageId: message.id,
                path: imagePath,
                base64: "",
                url,
                file: null
              }
            })
          : []
    )

    const images: MessageImage[] = await Promise.all(imagePromises.flat())
    setChatImages(images)

    const messageFileItemPromises = fetchedMessages.map(
      async message => await getMessageFileItemsByMessageId(message.id)
    )

    const messageFileItems = await Promise.all(messageFileItemPromises)

    const uniqueFileItems = messageFileItems.flatMap(item => item.file_items)
    setChatFileItems(uniqueFileItems)

    try {
      const chatFiles = await getChatFilesByChatId(params.chatid as string)

      setChatFiles(
        chatFiles.files?.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          file: null
        })) || []
      )

      setUseRetrieval(true)
      setShowFilesDisplay(true)
    } catch (error) {
      console.error("Error loading chat files:", error)
      setChatFiles([])
    }

    const fetchedChatMessages = fetchedMessages.map(message => {
      return {
        message,
        fileItems: messageFileItems
          .filter(messageFileItem => messageFileItem.id === message.id)
          .flatMap(messageFileItem =>
            messageFileItem.file_items.map(fileItem => fileItem.id)
          )
      }
    })

    setChatMessages(fetchedChatMessages)
  }

  const fetchChat = async () => {
    const chat = await getChatById(params.chatid as string)
    if (!chat) return

    if (chat.assistant_id) {
      const assistant = assistants.find(
        assistant => assistant.id === chat.assistant_id
      )

      if (assistant) {
        setSelectedAssistant(assistant)

        const assistantTools = (
          await getAssistantToolsByAssistantId(assistant.id)
        ).tools
        setSelectedTools(assistantTools)
      }
    }

    setSelectedChat(chat)
    setChatSettings({
      model: chat.model as LLMID,
      prompt: chat.prompt,
      temperature: chat.temperature,
      contextLength: chat.context_length,
      includeProfileContext: chat.include_profile_context,
      includeWorkspaceInstructions: chat.include_workspace_instructions,
      embeddingsProvider: chat.embeddings_provider as "openai" | "local"
    })
  }

  // 切换回文字聊天
  const switchToTextChat = () => {
    router.push(`/${params.locale}/${params.workspaceid}/chat/${params.chatid}`)
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="relative flex h-full flex-col items-center">
      <div className="absolute left-4 top-2.5 flex justify-center">
        <ChatScrollButtons
          isAtTop={isAtTop}
          isAtBottom={isAtBottom}
          isOverflowing={isOverflowing}
          scrollToTop={scrollToTop}
          scrollToBottom={scrollToBottom}
        />
      </div>

      <div className="absolute right-4 top-1 flex h-[40px] items-center space-x-2">
        {/* 切换到文字聊天按钮 */}
        <WithTooltip
          delayDuration={200}
          display={<div>切换到文字聊天</div>}
          trigger={
            <div className="mt-1">
              <IconKeyboard
                className="cursor-pointer hover:opacity-50"
                size={24}
                onClick={switchToTextChat}
              />
            </div>
          }
        />
      </div>

      <div className="bg-secondary flex max-h-[50px] min-h-[50px] w-full items-center justify-center border-b-2 font-bold">
        <div className="max-w-[200px] truncate sm:max-w-[400px] md:max-w-[500px] lg:max-w-[600px] xl:max-w-[700px]">
          📹 {selectedChat?.name || "视频聊天"}
        </div>
      </div>

      {/* 消息历史 */}
      <div
        className="flex size-full flex-col overflow-auto border-b"
        onScroll={handleScroll}
      >
        <div ref={messagesStartRef} />

        <ChatMessages />

        <div ref={messagesEndRef} />
      </div>

      {/* 视频输入控件 */}
      <div className="relative w-full min-w-[300px] items-end p-4 sm:w-[600px] md:w-[700px] lg:w-[700px] xl:w-[800px]">
        <VideoInput videoHandler={videoHandler} />
      </div>

      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>
    </div>
  )
}
