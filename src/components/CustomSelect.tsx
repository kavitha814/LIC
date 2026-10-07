import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  id?: string;
  required?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  style,
  buttonStyle,
  id,
  required
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && options.length > 7 && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, options.length]);

  const filteredOptions = options.filter(opt => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(term)) ||
      opt.value.toLowerCase().includes(term)
    );
  });

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div 
      ref={containerRef} 
      className={`custom-select-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input 
          tabIndex={-1}
          required={required}
          value={value}
          onChange={() => {}}
          style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', height: 0, width: 0 }}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm('');
          }
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '9px 12px',
          fontSize: '13px',
          fontWeight: 600,
          background: 'var(--bg-card, #ffffff)',
          border: isOpen ? '1.5px solid #d97706' : '1px solid var(--border-color)',
          borderRadius: '8px',
          color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)',
          boxShadow: isOpen ? '0 0 0 3px rgba(217, 119, 6, 0.15)' : 'var(--shadow-sm)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          outline: 'none',
          minHeight: '40px',
          ...buttonStyle
        }}
      >
        <span style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          flex: 1
        }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown 
          size={16} 
          style={{
            flexShrink: 0,
            color: isOpen ? '#d97706' : 'var(--text-dim)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }} 
        />
      </button>

      {/* Dropdown Menu (Opened inside the page itself, matching application theme) */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '270px',
          animation: 'dropdownFadeIn 0.15s ease-out'
        }}>
          {/* Optional Search Filter for long lists (e.g. Financial Years, Clients, Plans) */}
          {options.length > 7 && (
            <div style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Search size={14} color="var(--text-dim)" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  outline: 'none',
                  padding: '2px 0'
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '14px', fontSize: '12.5px', color: 'var(--text-dim)', textAlign: 'center' }}>
                No options match your search.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 700 : 500,
                      background: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'transparent',
                      color: isSelected ? '#b45309' : 'var(--text-main)',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'var(--bg-elevated, #f1f5f9)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 400 }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {opt.badge && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-dim)'
                        }}>
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check size={15} color="#d97706" strokeWidth={2.4} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
