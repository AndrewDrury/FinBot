export function Header() {
    return (
        <header className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <div>
                <h1 
                    className="text-2xl font-bold text-yellow-500 cursor-pointer" 
                    onClick={() => window.location.href = '/'}
                >
                    FinBot
                </h1>
                <p className="text-zinc-400">AI-powered financial assistant</p>
            </div>
            <button 
                className="bg-zinc-800  hover:bg-yellow-400 hover:text-zinc-900 text-zinc-300 hover:text-yellow-500 transition-colors px-4 py-2 rounded" 
                onClick={() => window.location.href = '/'}
            >
                New Chat
            </button>
        </header>
    );
}
