"use client";

import { useEffect, useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { Header } from "./Header";

export function ChatContainer() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <main className="flex flex-col h-screen">
      <Header />
      <ChatInterface />
    </main>
  );
}
