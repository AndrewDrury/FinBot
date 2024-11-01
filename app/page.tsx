import { ChatContainer } from './components/Container';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FinBot',
  description: 'AI-powered financial assistant',
};

export default function Home() {
  return <ChatContainer />;
}