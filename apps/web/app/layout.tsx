import type { Metadata } from 'next';
import './globals.css';
import InteractionHealthMonitor from '../components/interaction-health-monitor';

export const metadata: Metadata = {
  title: 'IIA Study Platform',
  description: 'Study smarter with AI-powered flashcards and PDFs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <InteractionHealthMonitor />
      </body>
    </html>
  );
}
