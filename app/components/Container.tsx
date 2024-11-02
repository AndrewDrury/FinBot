"use client";

import { useEffect, useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { Header } from "./Header";

export type Message = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

export function ChatContainer() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showExamples, setShowExamples] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const onNewChat = () => {
    setMessages([]);
    setShowExamples(true);
  };

  return (
    <main className="flex flex-col h-screen">
      <Header startNewChat={onNewChat} />
      <ChatInterface 
        messages={messages}
        setMessages={setMessages}
        showExamples={showExamples}
        setShowExamples={setShowExamples}/>
    </main>
  );
}
