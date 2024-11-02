"use client";

type HeaderProps = {
    startNewChat: () => void;
};

export function Header({ startNewChat }: HeaderProps) {
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
            <button
                className="bg-zinc-800 hover:bg-yellow-400 hover:text-zinc-900 text-zinc-300 transition-colors px-4 py-2 rounded"
                onClick={startNewChat}
            >
                New Chat
            </button>
        </header>
    );
}
