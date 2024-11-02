"use client";

import React from "react";

const AVAILABLE_MODELS = [
  { id: "gpt-4-turbo-preview", name: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
] as const;

export type OpenAIModelType = (typeof AVAILABLE_MODELS)[number]["id"];

type HeaderProps = {
  startNewChat: () => void;
  selectedModel: OpenAIModelType;
  onModelChange: (model: OpenAIModelType) => void;
};

export function Header({
  startNewChat,
  selectedModel,
  onModelChange,
}: HeaderProps) {
  const handleModelChange = (newModel: OpenAIModelType) => {
    onModelChange(newModel);
    startNewChat(); // Start new chat when model changes
  };

  return (
    <header className="fixed top-0 w-full p-6 border-b border-zinc-800 flex justify-between items-center bg-black z-50">
      <div>
        <h1
          className="text-2xl font-bold text-yellow-500 cursor-pointer"
          onClick={startNewChat}
        >
          FinBot
        </h1>
        <p className="text-zinc-400">AI-powered financial assistant</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <select
            value={selectedModel}
            onChange={(e) =>
              handleModelChange(e.target.value as OpenAIModelType)
            }
            className="appearance-none bg-zinc-800 text-zinc-300 px-3 py-2 pr-8 rounded border border-zinc-700 hover:border-yellow-500 focus:border-yellow-500 focus:outline-none cursor-pointer"
            style={{ paddingRight: "2rem" }}
          >
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <span className="absolute top-0 pt-1.5 right-3 flex items-center pointer-events-none text-zinc-400">
            ⌄
          </span>
        </div>
        <button
          className="bg-zinc-800 hover:bg-yellow-400 hover:text-zinc-900 text-zinc-300 transition-colors px-4 py-2 rounded"
          onClick={startNewChat}
        >
          New Chat
        </button>
      </div>
    </header>
  );
}
