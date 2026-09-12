'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function Home() {
  const [message, setMessage] = useState('');

  async function testRust() {
    const response = await invoke<string>('greet', {
      name: 'Dev',
    });

    setMessage(response);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">
        Local Music Player
      </h1>

      <button
        onClick={testRust}
        className="rounded-lg bg-white px-4 py-2 text-black"
      >
        Test Rust
      </button>

      <p>{message}</p>
    </main>
  );
}