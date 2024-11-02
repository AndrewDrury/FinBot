"use client";
import {
  useState,
  KeyboardEvent,
  FormEvent,
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
} from "react";
import ReactMarkdown from "react-markdown";
import { Message } from "./Container";
import { FMP_ENDPOINT_NAMES } from "@/lib/constants";

type MarkdownProps = {
  className?: string;
  children?: React.ReactNode;
  inline?: boolean;
};

type ChatInterfaceProps = {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  showExamples: boolean;
  setShowExamples: Dispatch<SetStateAction<boolean>>;
};

interface TimePeriod {
  year: number;
  quarter?: string;
}

const LoadingAnimation = () => (
  <div className="flex space-x-1">
    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse [animation-delay:200ms]" />
    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse [animation-delay:400ms]" />
  </div>
);

const formatTimePeriod = (period: TimePeriod): string => {
  return period.quarter
    ? `${period.quarter} ${period.year}`
    : `${period.year}`;
};

const LoadingMessage = ({
  companies,
  endpoints,
  timePeriods,
}: {
  companies: string[];
  endpoints: string[];
  timePeriods: TimePeriod[];
}) => {
  const hasData = companies.length > 0 && endpoints.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">
        {"FinBot is Acquiring Data..."}
      </h3>
      {hasData && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {companies.map((company) =>
              endpoints.map((endpoint) =>
                timePeriods.map((period) => (
                  <div
                    key={`${company}-${endpoint}-${period.year}-${period.quarter}`}
                    className="bg-zinc-700/50 rounded-lg p-3 text-sm flex flex-col items-center"
                  >
                    <span>
                      Reading <span className="text-yellow-500">{period.quarter} {period.year}</span>{" "}{FMP_ENDPOINT_NAMES[endpoint]} for{" "}
                      <span className="text-yellow-500">{company}</span>
                    </span>
                    <div className="mt-2">
                      <LoadingAnimation />
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const examplePrompts = [
  "Summarize Spotify's latest conference call.",
  "What has Airbnb management said about profitability over the last few earnings calls?",
  "What are Mark Zuckerberg's and Satya Nadella's recent comments about AI?",
  "How many new large deals did ServiceNow sign in the last quarter?",
];

export function ChatInterface({
  messages,
  setMessages,
  showExamples,
  setShowExamples,
}: ChatInterfaceProps) {
  const [input, setInput] = useState<string>("");
  const [listCompanies, setCompanies] = useState<string[]>([]);
  const [listEndpoints, setEndpoints] = useState<string[]>([]);
  const [listTimePeriods, setTimePeriods] = useState<TimePeriod[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const analyzeQuery = async (query: string) => {
    setLoading(true);

    // Show loading animation in assistant chatbox
    const loadingMessage: Message = {
      role: "assistant",
      content: "loading",
      isError: false,
    };
    setMessages((prev) => [...prev, loadingMessage]);
    try {
      // Step 1: Extract company names and other financial entities
      const companiesResponse = await fetch("/api/extractInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!companiesResponse.ok) {
        throw new Error("Failed to extract companies");
      }

      const { companies, endpoints, timePeriods } =
        await companiesResponse.json();
      if (companies.length) setCompanies(companies);
      if (endpoints.length) setEndpoints(endpoints);
      if (timePeriods.length) setTimePeriods(timePeriods);

      let allCompaniesData = [];

      // Step 2: Fetch financial data for each company/entity
      if (companies.length && endpoints.length) {
        const dataResponse = await fetch("/api/getFMPData", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies, endpoints, query, timePeriods }),
        });

        if (!dataResponse.ok) {
          throw new Error("Failed to fetch fmp data");
        }
        const { companiesData } = await dataResponse.json();
        allCompaniesData = JSON.parse(companiesData)
      }

      // Step 3: Generate assistant's response using fmp data collected
      const analysisResponse = await fetch("/api/generateResponse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          companiesData: allCompaniesData,
          messageHistory: messages.filter(
            (msg) => msg.role === "user" || msg.role === "assistant"
          ),
        }),
      });

      if (!analysisResponse.ok) {
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: "Failed to generate response",
            isError: true,
          };
          return newMessages;
        });
        throw new Error("Failed to generate assistant's response");
      }

      const { result } = await analysisResponse.json();

      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content: result,
          isError: false,
        };
        return newMessages;
      });
    } catch (err) {
      const errorMsg = "Failed to analyze query.";
      console.error(err);
      // Error response
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content: errorMsg,
          isError: true,
        };
        return newMessages;
      });
    } finally {
      setLoading(false);
      setEndpoints([]);
      setCompanies([]);
      setTimePeriods([]);
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
      {showExamples && messages.length === 0 && (
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
              className={`max-w-3xl rounded-lg p-4 min-w-1xl ${
                message.role === "user"
                  ? // user msg
                    "bg-yellow-500 text-zinc-900"
                  : message.isError
                  ? // error msg
                    "bg-red-900/50 text-red-200"
                  : // assistant msg
                    "bg-zinc-800 text-zinc-300"
              }`}
            >
              {message.content === "loading" ? (
                <LoadingMessage
                  companies={listCompanies}
                  endpoints={listEndpoints}
                  timePeriods={listTimePeriods}
                />
              ) : (
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
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 w-full p-6 border-t border-zinc-800 bg-zinc-900"
      >
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
            className="p-4 rounded-lg bg-yellow-500 text-zinc-900 hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
            disabled={loading || !input.trim()}
          >
            {loading ? <>Analyzing...</> : "→"}
          </button>
        </div>
      </form>
    </div>
  );
}
