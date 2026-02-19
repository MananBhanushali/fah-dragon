"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Leaderboard from '../components/Leaderboard';

export default function LeaderboardView({ initialLimit = 500 }) {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (mounted) setCurrentUser(d.user || null); })
      .catch(() => { if (mounted) setCurrentUser(null); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try { inputRef.current?.focus(); } catch (e) {}
  }, []);

  function doSearch(e) {
    e?.preventDefault();
    setSearchTerm(query.trim());
  }

  return (
    <div style={{ width: '100%', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            background: 'transparent',
            border: '1px solid rgba(124,58,237,0.18)',
            color: '#c084fc',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 700,
          }}>
            ← Back
          </Link>

          <div>
            <h1 style={{ margin: 0, color: '#c084fc' }}>Leaderboard</h1>
          </div>
        </div>

        <form onSubmit={doSearch} style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          <input
            ref={inputRef}
            aria-label="Search username"
            placeholder="Username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px 0 0 10px',
              border: inputFocused ? '1px solid rgba(124,58,237,0.7)' : '1px solid rgba(124,58,237,0.14)',
              background: inputFocused ? 'rgba(17,14,30,0.7)' : 'rgba(12,10,20,0.5)',
              color: '#e9d5ff',
              minWidth: 220,
              outline: 'none',
              boxShadow: inputFocused ? '0 6px 18px rgba(124,58,237,0.12)' : 'none',
              transition: 'all 150ms ease',
            }}
          />
          <button
            type="submit"
            aria-label="Search"
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              padding: '8px 14px',
              borderRadius: '0 10px 10px 0',
              background: btnHover ? 'linear-gradient(90deg, rgba(124,58,237,0.22), rgba(99,102,241,0.16))' : 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.28)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 120ms ease',
              boxShadow: btnHover ? '0 8px 20px rgba(124,58,237,0.12)' : 'none',
            }}
          >
             Search
          </button>
        </form>
      </div>

      <Leaderboard limit={initialLimit} searchTerm={searchTerm} />
    </div>
  );
}
