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
    throw new Error(error.message)
  }

  if (!chatFiles) {
    throw new Error(`Chat with id ${chatId} not found`)
  }

  return chatFiles
}

export const createChatFile = async (chatFile: TablesInsert<"chat_files">) => {
  const { data: createdChatFile, error } = await supabase
    .from("chat_files")
    .insert(chatFile)
    .select("*")

  if (error) {
    throw new Error(error.message)
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
    throw new Error(error.message)
  }

  if (!createdChatFiles) {
    throw new Error("Failed to create chat files")
  }

  return createdChatFiles
}
