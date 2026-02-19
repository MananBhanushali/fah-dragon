"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Leaderboard({ limit = 500, searchTerm = '' }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user: currentUser } = useAuth();

  // fetch users list when limit or searchTerm changes
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (searchTerm) params.set('q', searchTerm);

    fetch(`/api/leaderboard/users?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        setUsers(data.users || []);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setError('Unable to load leaderboard');
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [limit, searchTerm]);

  return (
    <div style={{
      width: '100%',
      maxHeight: '70vh',
      overflowY: 'auto',
      background: 'rgba(8,8,26,0.85)',
      border: '1px solid rgba(124,58,237,0.18)',
      padding: 16,
      borderRadius: 8,
      color: '#e9d5ff',
      fontFamily: 'Courier New, monospace',
      fontSize: 14,
    }}>
      {loading && (
        <div style={{ color: '#b794f4' }}>Loading leaderboard…</div>
      )}

      {error && (
        <div style={{ color: '#f87171' }}>{error}</div>
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users && users.length > 0 ? (
            users.map((u, idx) => {
              const isCurrent = currentUser && currentUser.id === u.id;
              return (
                <div
                  key={u.id}
                  aria-current={isCurrent ? 'true' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 8,
                    borderRadius: 6,
                    background: isCurrent ? 'linear-gradient(90deg, rgba(124,58,237,0.12), rgba(99,102,241,0.06))' : 'transparent',
                    border: isCurrent ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
                  }}
                >
                  <div style={{ color: '#a78bfa', fontWeight: 700, minWidth: 32 }}>#{idx + 1}</div>
                  <div style={{ flex: 1, color: isCurrent ? '#fff' : '#f3e8ff', fontWeight: isCurrent ? 800 : 400 }}>
                    {u.displayName || u.username || 'Anonymous'}
                  </div>
                  <div style={{ color: '#fef08a', fontWeight: 700 }}>{u.bestScore ?? 0}</div>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#9ca3af' }}>No scores yet</div>
          )}
        </div>
      )}
    </div>
  );
}
