"use client";

import { useState, useEffect, useRef } from "react";

export default function SettingsModal({ isOpen, onClose }) {
  const [fahOnSpace, setFahOnSpace] = useState(true);
  const [fahVolume, setFahVolume] = useState(50);
  const [loading, setLoading] = useState(true); // start true to block persist until loaded
  const loadedOnce = useRef(false); // track if initial load completed

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const s = data?.settings;
        if (s) {
          setFahOnSpace(typeof s.fahOnSpace === 'boolean' ? s.fahOnSpace : true);
          setFahVolume(typeof s.fahVolume === 'number' ? s.fahVolume : 50);
        }
        loadedOnce.current = true;
      })
      .catch(() => { loadedOnce.current = true; })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Persist changes to server (only after initial load)
  useEffect(() => {
    if (loading || !loadedOnce.current) return; // skip until first load done
    const payload = { fahOnSpace, fahVolume };
    try {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(() => {
          try {
            window.dispatchEvent(new CustomEvent('fah-settings-changed', { detail: { fahOnSpace, fahVolume } }));
          } catch (e) {}
        })
        .catch(() => {});
    } catch (err) {}
  }, [fahOnSpace, fahVolume, loading]);

  // notify immediately on local change for instant feedback
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('fah-settings-changed', { detail: { fahOnSpace, fahVolume } }));
    } catch (e) {}
  }, [fahOnSpace, fahVolume]);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-modal-close" onClick={onClose}>×</button>
        <h2>Settings</h2>

        {loading ? (
          <div style={{ color: '#a78bfa', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
        ) : (
          <>
            <div className="toggle-row">
              <div className="toggle-desc">Fahhh on SPACE</div>
              <label className="toggle" aria-label="Fah on SPACE">
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={fahOnSpace}
                  onChange={(e) => setFahOnSpace(e.target.checked)}
                />
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
              </label>
            </div>

            <div className="toggle-row" style={{ marginTop: 14 }}>
              <div className="toggle-desc">Fahhh volume</div>
              <div style={{ width: 220, display: 'flex', alignItems: 'center', gap: 10, opacity: fahOnSpace ? 1 : 0.5 }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={fahVolume}
                    onChange={(e) => setFahVolume(Number(e.target.value))}
                    disabled={!fahOnSpace}
                    aria-disabled={!fahOnSpace}
                    style={{ width: '160px', cursor: fahOnSpace ? 'auto' : 'not-allowed' }}
                  />
                  <div style={{ width: 40, textAlign: 'right', color: fahOnSpace ? '#e7d7ff' : '#9ca3af', fontFamily: "'Courier New', monospace" }}>{fahVolume}%</div>
                </div>
            </div>
          </>
        )}

      <style jsx>{`
        .settings-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 5, 26, 0.9);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(4px);
        }
        .settings-modal {
          background: rgba(20, 10, 40, 0.95);
          border: 1px solid rgba(140, 80, 220, 0.4);
          border-radius: 8px;
          padding: 36px;
          width: 100%;
          max-width: 520px;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(140,80,220,0.1);
          font-size: 16px;
          font-family: 'Courier New', monospace;
          z-index: 1001;
        }
        .settings-modal-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #6b5b95; font-size: 24px; cursor: pointer; padding: 4px 8px; }
        .settings-modal-close:hover { color: #c084fc; }
        h2 { margin: 0 0 18px; color: #c084fc; font-size: 22px; text-align: center; text-transform: uppercase; letter-spacing: 2px; font-family: 'Courier New', monospace; }
        .toggle-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; justify-content: space-between; }
        .toggle { display: inline-flex; align-items: center; cursor: pointer; position: relative; }
        .toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
        .toggle-track { display: inline-block; width: 46px; height: 26px; background: #333; border-radius: 999px; position: relative; transition: background 0.18s ease; }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; background: #fff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.25); transition: transform 0.18s ease; }
        .toggle-input:checked + .toggle-track { background: linear-gradient(90deg,#7c3aed 0%,#a855f7 100%); }
        .toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(20px); }
        .toggle-desc { color: #e7d7ff; font-family: 'Courier New', monospace; flex: 1; }
      `}</style>
      </div>
    </div>
  );
}
