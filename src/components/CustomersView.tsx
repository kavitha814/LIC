import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  PlusCircle, 
  FileDown, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Edit3, 
  Trash2, 
  X, 
  AlertTriangle, 
  FileText, 
  Plus,
  Shield
} from 'lucide-react';
import type { Customer, Policy, AppSettings } from '../types';
import { formatINR, formatDate, exportCustomersToCSV } from '../services/export';

interface CustomersViewProps {
  customers: Customer[];
  policies: Policy[];
  settings?: AppSettings;
  maskSensitive: boolean;
  onSaveCustomer: (customer: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onAddPolicyForCustomer: (customer: Customer) => void;
  onSelectPolicy: (policy: Policy) => void;
  initialSelectedCustomerId?: string | null;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  policies,
  maskSensitive,
  onSaveCustomer,
  onDeleteCustomer,
  onAddPolicyForCustomer,
  onSelectPolicy,
  initialSelectedCustomerId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialSelectedCustomerId || null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    fullName: '',
    mobile: '',
    email: '',
    address: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    dateOfBirth: '1985-01-01',
    gender: 'MALE',
    occupation: '',
    panNumber: '',
    aadhaarLast4: '',
    emergencyContact: '',
    notes: ''
  });

  // Filter customers
  const filteredCustomers = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return customers.filter(c => 
      !s ||
      c.fullName.toLowerCase().includes(s) ||
      c.mobile.includes(s) ||
      (c.city && c.city.toLowerCase().includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  }, [customers, searchTerm]);

  // Selected customer details & policies
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const customerPolicies = useMemo(() => {
    if (!activeCustomer) return [];
    return policies.filter(p => p.customerId === activeCustomer.id);
  }, [policies, activeCustomer]);

  // Totals for active customer
  const totalCustomerSA = customerPolicies.reduce((acc, p) => acc + (p.status === 'IN_FORCE' ? p.sumAssured : 0), 0);
  const totalCustomerPremium = customerPolicies.reduce((acc, p) => acc + (p.status === 'IN_FORCE' ? p.totalPremium : 0), 0);

  // Masking helpers
  const maskText = (val: string | undefined, type: 'PAN' | 'AADHAAR') => {
    if (!maskSensitive || !val) return val || '-';
    if (type === 'PAN') return val.slice(0, 2) + '•••••' + val.slice(-1);
    if (type === 'AADHAAR') return '•••• •••• ' + val;
    return val;
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      fullName: '',
      mobile: '',
      email: '',
      address: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      dateOfBirth: '1985-05-15',
      gender: 'MALE',
      occupation: '',
      panNumber: '',
      aadhaarLast4: '',
      emergencyContact: '',
      notes: ''
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({ ...c });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.mobile) {
      alert('Please fill in required fields (Name and Mobile).');
      return;
    }

    const toSave: Customer = {
      ...(formData as Customer),
      id: editingCustomer?.id || '',
      createdAt: editingCustomer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await onSaveCustomer(toSave);
    setIsFormOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div className="lic-card" style={{ padding: '18px 20px' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          marginBottom: '16px'
        }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Policyholders 360
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Directory of client profiles, multi-policy portfolios, and family insurance coverage
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button 
              type="button" 
              className="btn btn-gold"
              onClick={handleOpenAdd}
            >
              <PlusCircle size={15} />
              <span>Add Policyholder</span>
            </button>

            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => exportCustomersToCSV(filteredCustomers)}
              title="Export policyholders list to CSV"
            >
              <FileDown size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: '480px' }}>
          <Search 
            size={16} 
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
          />
          <input 
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search by Client Name, Mobile, City, Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid: Client Cards / Table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {filteredCustomers.map(cust => {
          const custPols = policies.filter(p => p.customerId === cust.id);
          const activeCount = custPols.filter(p => p.status === 'IN_FORCE').length;
          const totalSA = custPols.reduce((acc, p) => acc + (p.status === 'IN_FORCE' ? p.sumAssured : 0), 0);

          return (
            <div 
              key={cust.id} 
              className="lic-card" 
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderColor: selectedCustomerId === cust.id ? '#2563eb' : 'var(--border-color)',
                background: selectedCustomerId === cust.id ? '#eff6ff' : 'var(--bg-card)'
              }}
              onClick={() => setSelectedCustomerId(cust.id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                      {cust.fullName}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px', marginTop: '2px' }}>
                      <MapPin size={12} />
                      <span>{cust.city}, {cust.state}</span>
                    </div>
                  </div>

                  <span className="lic-badge" style={{
                    background: activeCount > 0 ? '#ecfdf5' : 'var(--bg-elevated)',
                    color: activeCount > 0 ? '#065f46' : 'var(--text-dim)',
                    border: activeCount > 0 ? '1px solid #a7f3d0' : '1px solid var(--border-color)'
                  }}>
                    {custPols.length} Policies ({activeCount} Active)
                  </span>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    <Phone size={13} color="#059669" />
                    <span>{cust.mobile}</span>
                  </div>

                  {cust.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                      <Mail size={13} color="#3b82f6" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.email}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    <Calendar size={13} color="#f59e0b" />
                    <span>DOB: {formatDate(cust.dateOfBirth)}</span>
                  </div>
                </div>

                {/* Portfolio Value summary */}
                <div style={{
                  marginTop: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={13} color="#0284c7" />
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Cover Sum Assured:</span>
                  </div>
                  <span className="mono-text" style={{ fontWeight: 700, fontSize: '14px', color: '#0284c7' }}>
                    {formatINR(totalSA)}
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{
                marginTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCustomerId(cust.id);
                  }}
                >
                  <FileText size={13} />
                  <span>360 Portfolio</span>
                </button>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(cust);
                    }}
                    title="Edit Client Profile"
                  >
                    <Edit3 size={13} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(cust.id);
                    }}
                    title="Delete Client"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Customer 360 Full Portfolio Modal */}
      {activeCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#b45309', fontWeight: 700 }}>
                  Policyholder 360° Profile
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '19px', color: 'var(--text-main)' }}>
                  {activeCustomer.fullName}
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  onClick={() => onAddPolicyForCustomer(activeCustomer)}
                >
                  <Plus size={14} />
                  <span>Add Policy for Client</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Overview Card */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                fontSize: '13px'
              }}>
                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Mobile Phone</div>
                  <div style={{ fontWeight: 600, color: '#059669' }}>{activeCustomer.mobile}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Email Address</div>
                  <div style={{ fontWeight: 600 }}>{activeCustomer.email || 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Date of Birth / Gender</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(activeCustomer.dateOfBirth)} ({activeCustomer.gender})</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>PAN Card (Confidential)</div>
                  <div className="mono-text" style={{ fontWeight: 600 }}>{maskText(activeCustomer.panNumber, 'PAN')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Aadhaar Last 4</div>
                  <div className="mono-text" style={{ fontWeight: 600 }}>{maskText(activeCustomer.aadhaarLast4, 'AADHAAR')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Occupation</div>
                  <div style={{ fontWeight: 600 }}>{activeCustomer.occupation || 'Business / Professional'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Address</div>
                  <div>{activeCustomer.address ? `${activeCustomer.address}, ${activeCustomer.city}, ${activeCustomer.state} - ${activeCustomer.pincode}` : `${activeCustomer.city}, ${activeCustomer.state}`}</div>
                </div>
                {activeCustomer.emergencyContact && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Family / Emergency Contact</div>
                    <div>{activeCustomer.emergencyContact}</div>
                  </div>
                )}
              </div>

              {/* Total Insurance Coverage Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Total Policies</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>{customerPolicies.length}</div>
                </div>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Active Sum Assured</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857' }}>{formatINR(totalCustomerSA)}</div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Annual Total Premium</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#b45309' }}>{formatINR(totalCustomerPremium)}</div>
                </div>
              </div>

              {/* Linked Policies Table */}
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
                  Policies Held by {activeCustomer.fullName} ({customerPolicies.length})
                </h4>

                {customerPolicies.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>No policies registered for this customer yet.</p>
                    <button
                      type="button"
                      className="btn btn-gold btn-sm"
                      style={{ marginTop: '10px' }}
                      onClick={() => onAddPolicyForCustomer(activeCustomer)}
                    >
                      + Add First Policy
                    </button>
                  </div>
                ) : (
                  <div className="lic-table-container">
                    <table className="lic-table">
                      <thead>
                        <tr>
                          <th>Policy #</th>
                          <th>Plan</th>
                          <th>Sum Assured</th>
                          <th>Premium</th>
                          <th>Next Due</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerPolicies.map(pol => (
                          <tr key={pol.id}>
                            <td className="mono-text" style={{ fontWeight: 700, color: '#60a5fa' }}>
                              #{pol.policyNumber}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{pol.planName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Table {pol.planNumber}</div>
                            </td>
                            <td className="mono-text">{formatINR(pol.sumAssured)}</td>
                            <td className="mono-text" style={{ color: '#fbbf24', fontWeight: 600 }}>
                              {formatINR(pol.totalPremium)}
                            </td>
                            <td>{formatDate(pol.nextDueDate)}</td>
                            <td>
                              <span className={`lic-badge ${pol.status === 'IN_FORCE' ? 'badge-in-force' : 'badge-lapsed'}`}>
                                {pol.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedCustomerId(null);
                                  onSelectPolicy(pol);
                                }}
                              >
                                View Record
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fb7185' }}>
                <AlertTriangle size={18} /> Confirm Delete
              </h3>
              <button 
                type="button" 
                onClick={() => setDeleteConfirmId(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                Are you sure you want to delete this customer record? All changes will be logged in the audit trail.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-danger btn-sm" 
                onClick={async () => {
                  if (deleteConfirmId) {
                    await onDeleteCustomer(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
              >
                Delete Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#d97706" />
                  {editingCustomer ? 'Edit Policyholder Profile' : 'Add New Policyholder'}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input 
                    type="text" 
                    className="form-input"
                    required
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Ramesh Kumar Patel"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input 
                    type="tel" 
                    className="form-input"
                    required
                    value={formData.mobile || ''}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="client@example.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={formData.dateOfBirth || ''}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select 
                    className="form-select"
                    value={formData.gender || 'MALE'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">City</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={formData.state || ''}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pincode</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={formData.pincode || ''}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">PAN Number (Confidential)</label>
                  <input 
                    type="text" 
                    className="form-input mono-text"
                    value={formData.panNumber || ''}
                    onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. ABCPS1234F"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Aadhaar (Last 4 digits only)</label>
                  <input 
                    type="text" 
                    maxLength={4}
                    className="form-input mono-text"
                    value={formData.aadhaarLast4 || ''}
                    onChange={(e) => setFormData({ ...formData, aadhaarLast4: e.target.value })}
                    placeholder="e.g. 8821"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Emergency / Family Contact</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={formData.emergencyContact || ''}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="Name (Relationship) - Phone"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Client Notes</label>
                  <textarea 
                    className="form-textarea"
                    rows={2}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Client preferences, payment instructions, etc."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  {editingCustomer ? 'Update Profile' : 'Save Policyholder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
