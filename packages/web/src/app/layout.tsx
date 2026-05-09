import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wixbury',
  description: 'A live city simulation — observe only.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
          <span className="font-semibold tracking-wide text-white">Wixbury</span>
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Map</a>
          <a href="/citizens" className="text-sm text-gray-400 hover:text-white transition-colors">Citizens</a>
          <a href="/newspaper" className="text-sm text-gray-400 hover:text-white transition-colors">Newspaper</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
