"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

export default function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  if (loading) {
    return <div className="user-menu-loading">...</div>;
  }

  return (
    <>
      <div className="user-menu">
        {user ? (
          <div className="user-logged-in">
            <button 
              className="user-button" 
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className="user-avatar">
                {(user.displayName || user.username)[0].toUpperCase()}
              </span>
              <span className="user-name">{user.displayName || user.username}</span>
            </button>
            
            {showDropdown && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <strong>{user.displayName || user.username}</strong>
                  <span>@{user.username}</span>
                </div>
                <button onClick={() => { logout(); setShowDropdown(false); }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="login-button" onClick={() => setShowAuth(true)}>
            Login / Sign Up
          </button>
        )}
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />

      <style jsx>{`
        .user-menu {
          position: relative;
        }

        .user-menu-loading {
          color: #6b5b95;
          padding: 8px 16px;
          font-size: 14px;
          font-family: 'Courier New', monospace;
        }

        .login-button {
          background: rgba(140, 80, 220, 0.15);
          border: 1px solid rgba(140, 80, 220, 0.4);
          border-radius: 6px;
          color: #9b7cc8;
          padding: 10px 18px;
          font-size: 14px;
          font-family: 'Courier New', monospace;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .login-button:hover {
          background: rgba(140, 80, 220, 0.25);
          border-color: rgba(168, 85, 247, 0.6);
          color: #c084fc;
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.3);
        }

        .user-logged-in {
          position: relative;
        }

        .user-button {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(140, 80, 220, 0.15);
          border: 1px solid rgba(140, 80, 220, 0.4);
          border-radius: 6px;
          padding: 10px 18px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .user-button:hover {
          background: rgba(140, 80, 220, 0.25);
          border-color: rgba(168, 85, 247, 0.6);
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.3);
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 600;
          font-size: 16px;
          font-family: 'Courier New', monospace;
        }

        .user-name {
          color: #9b7cc8;
          font-size: 16px;
          font-family: 'Courier New', monospace;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .user-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: rgba(20, 10, 40, 0.95);
          border: 1px solid rgba(140, 80, 220, 0.4);
          border-radius: 6px;
          min-width: 180px;
          overflow: hidden;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
        }

        .user-dropdown-header {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(140, 80, 220, 0.3);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-dropdown-header strong {
          color: #c084fc;
          font-size: 15px;
          font-family: 'Courier New', monospace;
        }

        .user-dropdown-header span {
          color: #6b5b95;
          font-size: 13px;
          font-family: 'Courier New', monospace;
        }

        .user-dropdown button {
          width: 100%;
          padding: 14px 18px;
          background: none;
          border: none;
          color: #c44;
          font-size: 14px;
          font-family: 'Courier New', monospace;
          text-align: left;
          cursor: pointer;
          transition: background 0.2s;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .user-dropdown button:hover {
          background: rgba(204, 68, 68, 0.15);
        }
      `}</style>
    </>
  );
}
