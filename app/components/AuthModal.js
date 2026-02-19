"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState("login"); // login or register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // If registering, require the user to accept the confirmation prompt
    if (mode === "register") {
      setShowConfirm(true);
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await login(username, password);
      }
      onClose();
      // Reset form
      setUsername("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (accepted) => {
    setShowConfirm(false);
    if (!accepted) return;

    setLoading(true);
    try {
      await register(username, password, displayName || username);
      onClose();
      setUsername("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>×</button>
        
        <h2>{mode === "login" ? "Login" : "Create Account"}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          {mode === "register" && (
            <div className="auth-input-group">
              <label htmlFor="displayName">Display Name (optional)</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others see you"
                maxLength={30}
              />
            </div>
          )}

          <div className="auth-input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>

        {/* Themed confirmation dialog for registration */}
        {showConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <p className="confirm-question">Do you believe that Manan is cute?</p>
              <div className="confirm-actions">
                <button className="confirm-no" onClick={() => handleConfirm(false)}>No</button>
                <button className="confirm-yes" onClick={() => handleConfirm(true)}>Yes</button>
              </div>
            </div>
          </div>
        )}

        <p className="auth-switch">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button type="button" onClick={() => { setMode("register"); setError(""); }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => { setMode("login"); setError(""); }}>
                Login
              </button>
            </>
          )}
        </p>
      </div>

      <style jsx>{`
        .auth-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(5, 5, 26, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .auth-modal {
          background: rgba(20, 10, 40, 0.95);
          border: 1px solid rgba(140, 80, 220, 0.4);
          border-radius: 8px;
          padding: 48px;
          width: 100%;
          max-width: 520px;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(140, 80, 220, 0.1);
          font-size: 20px; /* base text size for the modal */
        }

        .auth-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: none;
          border: none;
          color: #6b5b95;
          font-size: 24px;
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
          transition: color 0.2s;
        }

        .auth-modal-close:hover {
          color: #c084fc;
        }

        h2 {
          margin: 0 0 24px;
          color: #c084fc;
          font-size: 26px;
          text-align: center;
          font-family: 'Courier New', monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .auth-input-group {
          margin-bottom: 16px;
        }

        label {
          display: block;
          color: #9b7cc8;
          font-size: 14px;
          margin-bottom: 8px;
          font-family: 'Courier New', monospace;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(140, 80, 220, 0.1);
          border: 1px solid rgba(140, 80, 220, 0.3);
          border-radius: 6px;
          color: #e9d5ff;
          font-size: 20px;
          font-family: 'Courier New', monospace;
          outline: none;
          transition: all 0.2s;
        }

        input:focus {
          border-color: rgba(168, 85, 247, 0.6);
          background: rgba(140, 80, 220, 0.15);
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.2);
        }

        input::placeholder {
          color: #6b5b95;
        }

        .auth-error {
          color: #c44;
          font-size: 16px;
          margin: 0 0 16px;
          text-align: center;
          font-family: 'Courier New', monospace;
        }

        .auth-submit {
          width: 100%;
          padding: 16px;
          background: rgba(140, 80, 220, 0.2);
          border: 1px solid rgba(140, 80, 220, 0.5);
          border-radius: 6px;
          color: #c084fc;
          font-size: 20px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .auth-submit:hover:not(:disabled) {
          background: rgba(168, 85, 247, 0.3);
          border-color: rgba(168, 85, 247, 0.7);
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
          color: #e9d5ff;
        }

        .auth-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auth-switch {
          margin-top: 20px;
          text-align: center;
          color: #6b5b95;
          font-size: 16px;
          font-family: 'Courier New', monospace;
        }

        .auth-switch button {
          background: none;
          border: none;
          color: #a855f7;
          cursor: pointer;
          font-size: 16px;
          font-family: 'Courier New', monospace;
          padding: 0;
          transition: color 0.2s;
        }

        .auth-switch button:hover {
          color: #c084fc;
          text-decoration: underline;
        }

        /* Confirmation dialog styles */
        .confirm-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(5,5,26,0.6);
          z-index: 60;
        }
        .confirm-box {
          width: 100%;
          max-width: 420px;
          background: rgba(20,10,40,0.98);
          border: 1px solid rgba(140,80,220,0.4);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          text-align: center;
        }
        .confirm-question {
          color: #c084fc;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          margin: 0 0 14px;
        }
        .confirm-actions { display: flex; gap: 12px; justify-content: center; }
        .confirm-no, .confirm-yes {
          padding: 10px 18px;
          border-radius: 6px;
          border: 1px solid rgba(140,80,220,0.3);
          background: rgba(140,80,220,0.06);
          color: #e9d5ff;
          font-family: 'Courier New', monospace;
          font-size: 16px;
          cursor: pointer;
        }
        .confirm-no { background: rgba(60,40,70,0.6); color: #9b7cc8; }
        .confirm-yes { background: rgba(100,60,170,0.85); color: #fff; border-color: rgba(168,85,247,0.7); }
      `}</style>
    </div>
  );
}
