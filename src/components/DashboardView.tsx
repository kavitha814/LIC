import React from 'react';
import { 
  Shield, 
  TrendingUp, 
  CalendarClock, 
  FileCheck2, 
  ArrowUpRight, 
  PhoneCall,
  Info
} from 'lucide-react';
import type { Policy, Customer, DashboardStats, AppSettings, PolicyStatus, PremiumFrequency } from '../types';
import { formatINR, formatDate } from '../services/export';
import type { ActiveTab } from './Sidebar';

interface DashboardViewProps {
  stats: DashboardStats;
  policies: Policy[];
  customers: Customer[];
  settings: AppSettings;
  maskSensitive: boolean;
  onNavigate: (tab: ActiveTab) => void;
  onOpenNewPolicy?: () => void;
  onOpenOCR: () => void;
  onViewPolicyDetails: (policy: Policy) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  policies,
  customers: _customers,
  settings: _settings,
  maskSensitive,
  onNavigate,
  onOpenNewPolicy: _onOpenNewPolicy,
  onOpenOCR: _onOpenOCR,
  onViewPolicyDetails
}) => {
  // Urgent renewal list: in-force policies due in next 45 days or past due
  const now = new Date();
  const fortyFiveDaysLater = new Date();
  fortyFiveDaysLater.setDate(now.getDate() + 45);

  const upcomingRenewals = policies.filter(p => {
    if (p.status !== 'IN_FORCE' || !p.nextDueDate) return false;
    const due = new Date(p.nextDueDate);
    return due <= fortyFiveDaysLater;
  }).sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());



  // Masking helper
  const maskPolicyNum = (num: string) => {
    if (!maskSensitive || !num || num.length < 5) return num;
    return '•••••' + num.slice(-4);
  };

  const getStatusBadge = (status: PolicyStatus) => {
    switch (status) {
      case 'IN_FORCE':
        return <span className="lic-badge badge-in-force" style={{ fontSize: '10px', padding: '2px 7px' }}>IN-FORCE</span>;
      case 'LAPSED':
        return <span className="lic-badge badge-lapsed" style={{ fontSize: '10px', padding: '2px 7px' }}>LAPSED</span>;
      case 'PAID_UP':
        return <span className="lic-badge badge-paid-up" style={{ fontSize: '10px', padding: '2px 7px' }}>PAID-UP</span>;
      case 'MATURED':
        return <span className="lic-badge badge-matured" style={{ fontSize: '10px', padding: '2px 7px' }}>MATURED</span>;
      case 'CLAIM_PAID':
        return <span className="lic-badge badge-matured" style={{ fontSize: '10px', padding: '2px 7px' }}>CLAIM PAID</span>;
      default:
        return <span className="lic-badge" style={{ fontSize: '10px', padding: '2px 7px' }}>{status}</span>;
    }
  };

  const formatFrequencyLabel = (freq: PremiumFrequency | string) => {
    switch (freq) {
      case 'YEARLY': return 'Yearly';
      case 'HALF_YEARLY': return 'Half-Yearly';
      case 'QUARTERLY': return 'Quarterly';
      case 'MONTHLY_NACH': return 'Monthly (NACH)';
      case 'SINGLE_PREMIUM': return 'Single Premium';
      default: return (freq || '').replace('_', ' ');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {/* Box 1: In-Force Policies (Blue) */}
        <div className="stat-card" style={{ '--stat-accent': '#2563eb' } as React.CSSProperties}>
          <div>
            <div className="stat-label">In-Force Policies</div>
            <div className="stat-val" style={{ color: '#0f172a' }}>{stats.activePolicies}</div>
            <div className="stat-sub">
              <span style={{ color: '#059669', fontWeight: 600 }}>{((stats.activePolicies / (stats.totalPolicies || 1)) * 100).toFixed(0)}%</span> persistence rate
            </div>
          </div>
          <div style={{
            background: 'rgba(37, 99, 235, 0.1)',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <Shield size={22} color="#2563eb" />
          </div>
        </div>

        {/* Box 2: Total Sum Assured (Green) */}
        <div className="stat-card" style={{ '--stat-accent': '#059669' } as React.CSSProperties}>
          <div>
            <div className="stat-label">Total Sum Assured</div>
            <div className="stat-val" style={{ fontSize: '22px', color: '#0f172a' }}>{formatINR(stats.totalSumAssured)}</div>
            <div className="stat-sub">Active coverage value</div>
          </div>
          <div style={{
            background: 'rgba(5, 150, 105, 0.1)',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <TrendingUp size={22} color="#059669" />
          </div>
        </div>

        {/* Box 3: Annualized Premium (Blue) */}
        <div className="stat-card" style={{ '--stat-accent': '#2563eb' } as React.CSSProperties}>
          <div>
            <div className="stat-label">Annualized Premium</div>
            <div className="stat-val" style={{ fontSize: '22px', color: '#0f172a' }}>
              {formatINR(stats.annualPremiumPortfolio)}
            </div>
            <div className="stat-sub">Annual agency collection</div>
          </div>
          <div style={{
            background: 'rgba(37, 99, 235, 0.1)',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <FileCheck2 size={22} color="#2563eb" />
          </div>
        </div>

        {/* Box 4: Due in 30 Days (Green) */}
        <div className="stat-card" style={{ '--stat-accent': '#059669' } as React.CSSProperties}>
          <div>
            <div className="stat-label">Due in 30 Days</div>
            <div className="stat-val" style={{ color: '#0f172a' }}>
              {stats.duesNext30Days} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-dim)' }}>policies</span>
            </div>
            <div className="stat-sub">
              Amount: <strong style={{ color: 'var(--text-main)' }}>{formatINR(stats.dueAmountNext30Days)}</strong>
            </div>
          </div>
          <div style={{
            background: 'rgba(5, 150, 105, 0.1)',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <CalendarClock size={22} color="#059669" />
          </div>
        </div>
      </div>


      {/* Upcoming Renewals / Action Center */}
      <div className="lic-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarClock size={18} color="#f59e0b" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Upcoming Renewals & Dues</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('policies')}
              >
                <span>View All</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>

          {upcomingRenewals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-dim)' }}>
              <FileCheck2 size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p>No renewals due within the next 45 days. All active policies are up to date!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingRenewals.slice(0, 5).map(pol => {
                const isProposal = pol.policyNumber.startsWith('PROP-');
                const isMatured = pol.status === 'MATURED';
                const planLabel = pol.planName.includes(pol.planNumber) 
                  ? pol.planName 
                  : `${pol.planName} (${pol.planNumber})`;

                return (
                  <div 
                    key={pol.id}
                    onClick={() => onViewPolicyDetails(pol)}
                    style={{
                      background: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md, 12px)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '9px',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'box-shadow 0.15s ease'
                    }}
                  >
                    {/* Card Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: isProposal ? '#b45309' : '#2563eb', letterSpacing: '0.01em' }}>
                        {isProposal ? `${pol.policyNumber} (Proposal)` : maskPolicyNum(pol.policyNumber)}
                      </span>
                      {getStatusBadge(pol.status)}
                    </div>

                    {/* Customer & Plan */}
                    <div>
                      <div 
                        style={{ 
                          fontSize: '14.5px', 
                          fontWeight: 800, 
                          color: 'var(--text-main)', 
                          lineHeight: 1.2 
                        }}
                      >
                        {pol.customerName}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {planLabel} • DOC: {formatDate(pol.dateOfCommencement)}
                      </div>
                    </div>

                    {/* Metrics Row: Sum Assured, Premium, Next Due all in same orange color #d97706 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '11.5px'
                    }}>
                      <div>
                        <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>Sum Assured</div>
                        <div style={{ fontWeight: 800, color: '#d97706', fontSize: '12.5px' }}>{formatINR(pol.sumAssured)}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>Premium</div>
                        <div style={{ fontWeight: 800, color: '#d97706', fontSize: '12.5px' }}>{formatINR(pol.totalPremium)}</div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>
                          {isMatured ? 'Maturity' : 'Next Due'}
                        </div>
                        <div style={{ fontWeight: 800, color: '#d97706', fontSize: '12.5px' }}>
                          {formatDate(isMatured ? pol.dateOfMaturity : pol.nextDueDate)}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer: Payment mode on left, Call and Details buttons on right */}
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px dashed var(--border-subtle)',
                        marginTop: '2px'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
                        Payment: <strong style={{ color: 'var(--text-main)' }}>{formatFrequencyLabel(pol.frequency)}</strong>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {pol.customerMobile && (
                          <a
                            href={`tel:${pol.customerMobile}`}
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11.5px',
                              gap: '4px',
                              color: '#059669',
                              borderColor: '#a7f3d0',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            title={`Call ${pol.customerMobile}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PhoneCall size={13} color="#059669" />
                            <span>Call</span>
                          </a>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onViewPolicyDetails(pol)}
                          style={{ padding: '4px 10px', fontSize: '11.5px', gap: '4px' }}
                          title="View Details"
                        >
                          <Info size={13} />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

    </div>
  );
};
