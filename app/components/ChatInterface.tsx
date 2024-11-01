"use client";
import { useState, KeyboardEvent, FormEvent, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';

type Message = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

type MarkdownProps = {
  className?: string;
  children?: React.ReactNode;
  inline?: boolean;
};


const LoadingAnimation = () => (
  <div className="flex space-x-1">
    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse [animation-delay:200ms]" />
    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse [animation-delay:400ms]" />
  </div>
);

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const analyzeQuery = async (query: string) => {
    setLoading(true);
    
    // Show loading animation in assistant chatbox
    const loadingMessage: Message = { role: "assistant", content: "loading", isError: false };
    setMessages(prev => [...prev, loadingMessage]);
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
      // Success response
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content: data.result,
          isError: false,
        };
        return newMessages;
    });
    } catch (err) {
      const errorMsg = "Failed to analyze query.";
      console.error(err)
      // Error response
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content: errorMsg,
          isError: true,
        };
        return newMessages;});
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (input: string) => {
    setInput("");
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
    <div className="flex-1 flex flex-col pt-24 pb-24">
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
                  : message.isError
                  // msg error
                  ? "bg-red-900/50 text-red-200"
                  // assistant
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {message.content === 'loading' ? (
                <LoadingAnimation/>
                ) : ((
                  <ReactMarkdown
                    className="max-w-none"
                    components={{
                      // Style code blocks and inline code
                      code: ({ className, children, inline }: MarkdownProps) => (
                        <code
                          className={`${className} ${
                            inline 
                              ? "bg-zinc-700/50 px-1 py-0.5 rounded text-sm" 
                              : "block bg-zinc-700/50 p-2 rounded-lg"
                          }`}
                        >
                          {children}
                        </code>
                      ),
                      // Style links
                      a: ({ children, ...props }) => (
                        <a 
                          className="text-yellow-500 hover:text-yellow-400 underline"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      // Style lists
                      ul: ({ children, ...props }) => (
                        <ul className="list-disc pl-4 space-y-1" {...props}>
                          {children}
                        </ul>
                      ),
                      ol: ({ children, ...props }) => (
                        <ol className="list-decimal pl-4 space-y-1" {...props}>
                          {children}
                        </ol>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ))
              }
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="fixed bottom-0 w-full p-6 border-t border-zinc-800 bg-zinc-900">
        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about financial insights..."
            className="flex-1 p-4 rounded-lg bg-zinc-800 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            disabled={loading}
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
