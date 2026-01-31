"use client";

import { useParams } from "next/navigation";
import ChatPage from "../page";

// Re-export the main chat page with the chatId param
export default function ChatByIdPage() {
  const params = useParams();
  return <ChatPage initialChatId={params.chatId} />;
}
