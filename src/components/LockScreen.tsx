import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import type { AppSettings } from '../types';

interface LockScreenProps {
  settings: AppSettings;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ settings, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        if (nextPin === (settings.pinCode || '1234')) {
          onUnlock();
        } else {
          setError(true);
          setTimeout(() => setPin(''), 600);
        }
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(241, 245, 249, 0.88)',
      backdropFilter: 'blur(16px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '36px 32px',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-xl)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 4px 16px rgba(217, 119, 6, 0.25)'
        }}>
          <Lock size={26} color="#ffffff" />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
          LIC Policy Manager
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Enter PIN to access confidential policy registers
        </p>

        {/* PIN Indicators */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '14px',
          marginBottom: '24px'
        }}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: isFilled ? (error ? '#e11d48' : '#d97706') : '#f1f5f9',
                  border: isFilled ? 'none' : '1px solid #cbd5e1',
                  transition: 'all 0.2s ease',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)'
                }}
              />
            );
          })}
        </div>

        {error && (
          <div style={{
            fontSize: '12px',
            color: '#be123c',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <AlertCircle size={14} />
            <span>Incorrect PIN. Try again.</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          maxWidth: '260px',
          margin: '0 auto'
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => {
            const isSpecial = btn === 'C' || btn === '⌫';
            return (
              <button
                key={btn}
                type="button"
                onClick={() => {
                  if (btn === 'C') handleClear();
                  else if (btn === '⌫') setPin(pin.slice(0, -1));
                  else handleDigit(btn);
                }}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  background: isSpecial ? '#f1f5f9' : '#ffffff',
                  border: '1px solid var(--border-color)',
                  color: isSpecial ? 'var(--text-muted)' : 'var(--text-main)',
                  fontSize: isSpecial ? '14px' : '20px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  boxShadow: isSpecial ? 'none' : 'var(--shadow-sm)',
                  transition: 'all 0.15s ease'
                }}
              >
                {btn}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: '24px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
          Default PIN is: <strong style={{ color: '#b45309' }}>{settings.pinCode || '1234'}</strong>
        </div>
      </div>
    </div>
  );
};
