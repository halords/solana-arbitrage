import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Solana Arbitrage Research & Trading Platform',
  description: 'High-frequency Solana DEX arbitrage monitoring, simulation, and paper trading dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
