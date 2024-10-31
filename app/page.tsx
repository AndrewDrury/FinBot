import { ChatInterface } from './components/ChatInterface';

export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-zinc-900">
      <header className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-yellow-500">FinBot</h1>
        <p className="text-zinc-400">AI-powered financial assistant</p>
      </header>
      
      <ChatInterface />
    </main>
  );
}