"use client";

export default function HowToModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="howto-modal-overlay" onClick={onClose}>
      <div className="howto-modal" onClick={(e) => e.stopPropagation()}>
        <button className="howto-modal-close" onClick={onClose}>×</button>
        <h2>How to play</h2>

        <div style={{ marginBottom: 12, fontSize: 18, color: '#e9d5ff' }}>
          Fly the Fah Dragon through the tunnels and avoid obstacles.
        </div>

        <div style={{ marginBottom: 14, fontSize: 18 }}>
          <div style={{ color: '#e7d7ff', marginBottom: 8, fontSize: 16 }}>Controls</div>
          <div style={{ marginBottom: 6, color: '#f0eaff' }}>[W A S D] or [↑ ↓ ← →] — Fly</div>
          <div style={{ marginBottom: 6, color: '#f0eaff' }}>[SPACE] — SONAR pulse (reveals walls, uses Plasma)</div>
          <div style={{ color: '#f0eaff' }}>[ESC] — Pause </div>
        </div>

        <div style={{ marginBottom: 14, fontSize: 18 }}>
          <div style={{ color: '#e7d7ff', marginBottom: 8, fontSize: 16 }}>Powerups</div>
          <div style={{ marginBottom: 6, color: '#f0eaff' }}>◆ <strong style={{ color: '#eaffea' }}>IMMUNITY</strong> — temporary invulnerability</div>
          <div style={{ marginBottom: 6, color: '#f0eaff' }}>◉ <strong style={{ color: '#ffd6d6' }}>FIREBALL</strong> — destroys obstacles in the path of SONAR</div>
          <div style={{ color: '#f0eaff' }}>◈ <strong style={{ color: '#cfe8ff' }}>PLASMA</strong> — refills pulse energy</div>
        </div>

        <div style={{ marginTop: 6, color: '#e6d8ff', fontWeight: 700, fontSize: 18 }}>
          ▶ Press SPACE to start
        </div>

      <style jsx>{`
        .howto-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 5, 26, 0.9);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(4px);
        }
        .howto-modal {
          background: rgba(20, 10, 40, 0.95);
          border: 1px solid rgba(140, 80, 220, 0.4);
          border-radius: 8px;
          padding: 48px;
          width: 100%;
          max-width: 520px;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(140,80,220,0.1);
          font-size: 20px;
          font-family: 'Courier New', monospace;
          z-index: 1001;
        }
        .howto-modal-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #6b5b95; font-size: 24px; cursor: pointer; padding: 4px 8px; }
        .howto-modal-close:hover { color: #c084fc; }
        h2 { margin: 0 0 24px; color: #c084fc; font-size: 26px; text-align: center; text-transform: uppercase; letter-spacing: 2px; font-family: 'Courier New', monospace; }
      `}</style>
      </div>
    </div>
  );
}
