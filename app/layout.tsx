import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://apportion-allocation-lab.skaihai.chatgpt.site'),
  title: 'APPORTION — Who gets the next seat?',
  description: 'An exact-arithmetic allocation lab. Compare proportional rules, inspect each award and explore the effects of adding one seat.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
