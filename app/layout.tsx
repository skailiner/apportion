import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://skailiner-apportion.static.hf.space/index.html',
  ),
  title: 'APPORTION — Share limited places. Explain the choices.',
  description:
    'Compare three proportional allocation rules for your groups. Save inputs, inspect exact ties and take a clear discussion brief to the people deciding.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
