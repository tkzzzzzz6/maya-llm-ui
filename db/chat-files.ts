import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert } from "@/supabase/types"

export const getChatFilesByChatId = async (chatId: string) => {
  const { data: chatFiles, error } = await supabase
    .from("chats")
    .select(
      `
      id,
      name,
      files (*)
    `
    )
    .eq("id", chatId)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch chat files:", error)
    // 返回空数据而不是抛出错误，避免阻塞页面加载
    return { id: chatId, name: "", files: [] }
  }

  if (!chatFiles) {
    console.warn(`Chat with id ${chatId} not found, returning empty data`)
    // 返回空数据而不是抛出错误
    return { id: chatId, name: "", files: [] }
  }

  return chatFiles
}

export const createChatFile = async (chatFile: TablesInsert<"chat_files">) => {
  const { data: createdChatFile, error } = await supabase
    .from("chat_files")
    .insert(chatFile)
    .select("*")

  if (error) {
    throw new Error(error?.message || "Failed to create chat file")
  }

  if (!createdChatFile) {
    throw new Error("Failed to create chat file")
  }

  return createdChatFile
}

export const createChatFiles = async (
  chatFiles: TablesInsert<"chat_files">[]
) => {
  const { data: createdChatFiles, error } = await supabase
    .from("chat_files")
    .insert(chatFiles)
    .select("*")

  if (error) {
    throw new Error(error?.message || "Failed to create chat files")
  }

  if (!createdChatFiles) {
    throw new Error("Failed to create chat files")
  }

  return createdChatFiles
}
