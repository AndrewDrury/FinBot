"use client";
import { useState, KeyboardEvent, FormEvent } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const examplePrompts = [
  "Summarize Spotify's latest conference call.",
  "What has Airbnb management said about profitability over the last few earnings calls?",
  "What are Mark Zuckerberg's and Satya Nadella's recent comments about AI?",
  "How many new large deals did ServiceNow sign in the last quarter?",
];

export function ChatInterface() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showExamples, setShowExamples] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  const analyzeQuery = async (query: string) => {
    setLoading(true);
    try {
      console.log('query', query)
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      console.log('response', response)

      if (!response.ok) {
        throw new Error("Failed to analyze query");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.result,
        },
      ]);
    } catch (err) {
      const errMsg = "Failed to analyze query. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errMsg,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (input: string) => {
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    analyzeQuery(input);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleSendMessage(input);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const handleExampleClick = (query: string) => {
    setShowExamples(false);
    handleSendMessage(query);
  };

  return (
    <div className="flex-1 flex flex-col">
      {showExamples && (
        <div className="grid grid-cols-2 gap-4 p-6">
          {examplePrompts.map((query, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(query)}
              className="p-4 text-left rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-yellow-500 transition-colors"
            >
              {query}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-3xl rounded-lg p-4 ${
                message.role === "user"
                  ? "bg-yellow-500 text-zinc-900"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-6 border-t border-zinc-800">
        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about financial insights..."
            className="flex-1 p-4 rounded-lg bg-zinc-800 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <button
            type="submit"
            className="p-4 rounded-lg bg-yellow-500 text-zinc-900 hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !input.trim()}
          >
            {loading ? <>Analyzing...</> : "→"}
          </button>
        </div>
      </form>
    </div>
  );
}
