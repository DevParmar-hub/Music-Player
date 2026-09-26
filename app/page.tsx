'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function Home() {
  const [message, setMessage] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState('');
  const [artistStatus, setArtistStatus] = useState('');
  const [albumStatus, setAlbumStatus] = useState('');

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

  // -------------------------
  // Artist Tests
  // -------------------------

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

  async function testGetArtists() {
    try {
      const response = await invoke<string>('test_get_artists');

      setArtistStatus(`Artists:\n${response}`);
    } catch (error) {
      setArtistStatus(
        `Artist read failed: ${String(error)}`
      );
    }
  }

  // -------------------------
  // Album Tests
  // -------------------------

  async function testInsertAlbum() {
    try {
      const response = await invoke<string>('test_insert_album', {
        title: 'Hybrid Theory',
        artistId: 1,
      });

      setAlbumStatus(response);
    } catch (error) {
      setAlbumStatus(
        `Album insertion failed: ${String(error)}`
      );
    }
  }

  async function testGetAlbums() {
    try {
      const response = await invoke<string>('test_get_albums');

      setAlbumStatus(`Albums:\n${response}`);
    } catch (error) {
      setAlbumStatus(
        `Album read failed: ${String(error)}`
      );
    }
  }

  async function testUpdateAlbum() {
    try {
      const response = await invoke<string>('test_update_album', {
        albumId: 1,
        title: 'Hybrid Theory (Updated)',
        artistId: 1,
      });

      setAlbumStatus(response);
    } catch (error) {
      setAlbumStatus(
        `Album update failed: ${String(error)}`
      );
    }
  }

  async function testDeleteAlbum() {
    try {
      const response = await invoke<string>('test_delete_album', {
        albumId: 1,
      });

      setAlbumStatus(response);
    } catch (error) {
      setAlbumStatus(
        `Album deletion failed: ${String(error)}`
      );
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">
        Local Music Player
      </h1>

      {/* Rust IPC */}
      <button
        onClick={testRust}
        className="rounded-lg bg-white px-4 py-2 text-black"
      >
        Test Rust
      </button>

      <p>{message}</p>

      {/* Database */}
      <button
        onClick={testDatabase}
        className="rounded-lg bg-white px-4 py-2 text-black"
      >
        Test Database
      </button>

      <p className="max-w-2xl whitespace-pre-wrap break-all">
        {databaseStatus}
      </p>

      {/* Artists */}
      <section className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold">
          Artists
        </h2>

        <button
          onClick={testInsertArtist}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Insert Artist
        </button>

        <button
          onClick={testGetArtists}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Get Artists
        </button>

        <p className="max-w-2xl whitespace-pre-wrap break-all">
          {artistStatus}
        </p>
      </section>

      {/* Albums */}
      <section className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold">
          Albums
        </h2>

        <button
          onClick={testInsertAlbum}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Insert Album
        </button>

        <button
          onClick={testGetAlbums}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Get Albums
        </button>

        <button
          onClick={testUpdateAlbum}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Update Album
        </button>

        <button
          onClick={testDeleteAlbum}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Delete Album
        </button>

        <p className="max-w-2xl whitespace-pre-wrap break-all">
          {albumStatus}
        </p>
      </section>
    </main>
  );
}