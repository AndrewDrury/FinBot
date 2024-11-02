"use client";

import { useEffect, useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { Header, OpenAIModelType } from "./Header";
import { DEFAULT_GPT_MODEL } from "@/lib/constants";

export type Message = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

export function ChatContainer() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showExamples, setShowExamples] = useState(true);
  const [selectedGptModel, setSelectedGptModel] =
    useState<OpenAIModelType>(DEFAULT_GPT_MODEL);

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
      <Header
        startNewChat={onNewChat}
        selectedModel={selectedGptModel}
        onModelChange={setSelectedGptModel}
      />
      <ChatInterface
        messages={messages}
        setMessages={setMessages}
        showExamples={showExamples}
        setShowExamples={setShowExamples}
        selectedGptModel={selectedGptModel}
      />
    </main>
  );
}
