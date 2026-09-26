'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function Home() {
  const [message, setMessage] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState('');
  const [artistStatus, setArtistStatus] = useState('');

  async function testRust() {
    try {
      const response = await invoke<string>('greet', {
        name: 'Dev',
      });

      setMessage(response);
    } catch (error) {
      setMessage(`Rust error: ${String(error)}`);
    }
  }

  async function testDatabase() {
    try {
      const response = await invoke<string>('verify_database');

      setDatabaseStatus(response);
    } catch (error) {
      setDatabaseStatus(
        `Database connection failed: ${String(error)}`
      );
    }
  }

  async function testInsertArtist() {
    try {
      const response = await invoke<string>('test_insert_artist', {
        name: 'Linkin Park',
      });

      setArtistStatus(response);
    } catch (error) {
      setArtistStatus(
        `Artist insertion failed: ${String(error)}`
      );
    }
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

      <button
        onClick={testDatabase}
        className="rounded-lg bg-white px-4 py-2 text-black"
      >
        Test Database
      </button>

      <p className="max-w-2xl whitespace-pre-wrap break-all">
        {databaseStatus}
      </p>

      <button
        onClick={testInsertArtist}
        className="rounded-lg bg-white px-4 py-2 text-black"
      >
        Test Insert Artist
      </button>

      <p className="max-w-2xl whitespace-pre-wrap break-all">
        {artistStatus}
      </p>
    </main>
  );
}