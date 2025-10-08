"use client"

import { VideoChatRealtimeUI } from "@/components/chat/video-chat-realtime-ui"

export default function VideoChatPage() {
  return (
    <div className="container mx-auto max-w-4xl p-4">
      <VideoChatRealtimeUI
        onResponse={text => {
          console.log("收到 AI 响应:", text)
        }}
      />
    </div>
  )
}
