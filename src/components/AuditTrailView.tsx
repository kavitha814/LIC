import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  FileDown
} from 'lucide-react';
import type { AuditLog } from '../types';
import { formatDate, exportAuditLogsToCSV } from '../services/export';

interface AuditTrailViewProps {
  auditLogs: AuditLog[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ auditLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !s ||
        log.entitySummary.toLowerCase().includes(s) ||
        log.userName.toLowerCase().includes(s) ||
        (log.entityId && log.entityId.toLowerCase().includes(s));

      const matchAction = selectedAction === 'ALL' || log.action === selectedAction;
      return matchSearch && matchAction;
    });
  }, [auditLogs, searchTerm, selectedAction]);

  const getActionBadge = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE':
        return <span className="lic-badge badge-in-force">CREATE</span>;
      case 'UPDATE':
        return <span className="lic-badge badge-paid-up">UPDATE</span>;
      case 'DELETE':
        return <span className="lic-badge badge-lapsed">DELETE</span>;
      case 'EXPORT':
        return <span className="lic-badge badge-matured">EXPORT</span>;
      case 'RESTORE':
        return <span className="lic-badge" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>RESTORE</span>;
      case 'OCR_DIGITIZE':
        return <span className="lic-badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>OCR DIGITIZE</span>;
      default:
        return <span className="lic-badge">{action}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Card */}
      <div className="lic-card" style={{ padding: '20px 24px' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          marginBottom: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={20} color="#d97706" />
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                System Audit Trail & Security Log
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Immutable record of policy registrations, modifications, deletions, and data export operations.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => exportAuditLogsToCSV(filteredLogs)}
            title="Export audit log to CSV"
          >
            <FileDown size={15} />
            <span>Export Audit Trail (CSV)</span>
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search 
              size={15} 
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
            />
            <input 
              type="text"
              className="form-input"
              style={{ paddingLeft: '34px' }}
              placeholder="Search audit trail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="EXPORT">EXPORT</option>
            <option value="RESTORE">RESTORE</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="lic-table-container">
        <table className="lic-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Operator / Role</th>
              <th>Activity Summary</th>
              <th>Entity Type</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                  No audit trail records found.
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => {
                const dateObj = new Date(log.timestamp);
                const timeStr = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '';

                return (
                  <tr key={log.id}>
                    <td>
                      <div className="mono-text" style={{ fontSize: '12px' }}>
                        {formatDate(log.timestamp)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {timeStr}
                      </div>
                    </td>

                    <td>
                      {getActionBadge(log.action)}
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{log.userName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{log.userRole}</div>
                    </td>

                    <td>
                      <div style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                        {log.entitySummary}
                      </div>
                      {log.details && (
                        <div className="mono-text" style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          {JSON.stringify(log.details)}
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{
                        fontSize: '11px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        color: 'var(--text-muted)'
                      }}>
                        {log.entityType}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
