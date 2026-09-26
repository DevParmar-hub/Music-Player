'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function Home() {
  const [message, setMessage] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState('');
  const [artistStatus, setArtistStatus] = useState('');
  const [albumStatus, setAlbumStatus] = useState('');
  const [trackStatus, setTrackStatus] = useState('');

  // -------------------------
  // Rust IPC Test
  // -------------------------

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

  // -------------------------
  // Database Test
  // -------------------------

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

  // -------------------------
  // Track Tests
  // -------------------------

  async function testInsertTrack() {
    try {
      const response = await invoke<string>('test_insert_track', {
        contentKey: 'test-content-key-001',
        filePath: 'C:\\Music\\Linkin Park\\In The End.mp3',
        title: 'In the End',
        artistId: 1,
        albumId: 1,
        genre: 'Alternative Rock',
        trackNumber: 8,
        discNumber: 1,
        durationMs: 216000,
        dateAdded: Date.now(),
        fileMtime: Date.now(),
      });

      setTrackStatus(response);
    } catch (error) {
      setTrackStatus(
        `Track insertion failed: ${String(error)}`
      );
    }
  }

  async function testGetTracks() {
    try {
      const response = await invoke<string>('test_get_tracks');

      setTrackStatus(`Tracks:\n${response}`);
    } catch (error) {
      setTrackStatus(
        `Track read failed: ${String(error)}`
      );
    }
  }

  async function testUpdateTrack() {
    try {
      const response = await invoke<string>('test_update_track', {
        trackId: 1,
        title: 'In the End (Updated)',
        artistId: 1,
        albumId: 1,
        genre: 'Rock',
        trackNumber: 8,
        discNumber: 1,
      });

      setTrackStatus(response);
    } catch (error) {
      setTrackStatus(
        `Track update failed: ${String(error)}`
      );
    }
  }

  async function testDeleteTrack() {
    try {
      const response = await invoke<string>('test_delete_track', {
        trackId: 1,
      });

      setTrackStatus(response);
    } catch (error) {
      setTrackStatus(
        `Track deletion failed: ${String(error)}`
      );
    }
  }

  // -------------------------
  // UI
  // -------------------------

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">
        Local Music Player
      </h1>

      {/* Rust IPC */}
      <section className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold">
          Rust IPC
        </h2>

        <button
          onClick={testRust}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Rust
        </button>

        <p className="max-w-2xl whitespace-pre-wrap break-all">
          {message}
        </p>
      </section>

      {/* Database */}
      <section className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold">
          Database
        </h2>

        <button
          onClick={testDatabase}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Database
        </button>

        <p className="max-w-2xl whitespace-pre-wrap break-all">
          {databaseStatus}
        </p>
      </section>

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

      {/* Tracks */}
      <section className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold">
          Tracks
        </h2>

        <button
          onClick={testInsertTrack}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Insert Track
        </button>

        <button
          onClick={testGetTracks}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Get Tracks
        </button>

        <button
          onClick={testUpdateTrack}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Update Track
        </button>

        <button
          onClick={testDeleteTrack}
          className="rounded-lg bg-white px-4 py-2 text-black"
        >
          Test Delete Track
        </button>

        <p className="max-w-2xl whitespace-pre-wrap break-all">
          {trackStatus}
        </p>
      </section>
    </main>
  );
}