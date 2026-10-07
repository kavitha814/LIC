import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Printer,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Shield,
  FileCheck2,
  UserPlus,
  Calendar,
  Check,
  User
} from 'lucide-react';
import type { Policy, Customer, PolicyStatus, PremiumFrequency, AppSettings } from '../types';
import { formatINR, formatDate, generatePolicySchedulePDF } from '../services/export';
import { LIC_POPULAR_PLANS } from '../data/licPlans';
import { CustomSelect } from './CustomSelect';

interface PoliciesViewProps {
  policies: Policy[];
  customers: Customer[];
  settings: AppSettings;
  maskSensitive: boolean;
  onSavePolicy: (policy: Policy) => Promise<void>;
  onDeletePolicy: (id: string) => Promise<void>;
  onSelectCustomer: (customerId: string) => void;
  initialSelectedPolicy?: Policy | null;
  isCreateOpen?: boolean;
  onCloseCreate?: () => void;
  targetCustomer?: Customer | null;
  onSaveCustomer?: (customer: Customer) => Promise<Customer>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  customers,
  settings,
  maskSensitive,
  onSavePolicy,
  onDeletePolicy,
  onSelectCustomer,
  initialSelectedPolicy,
  isCreateOpen = false,
  onCloseCreate,
  targetCustomer,
  onSaveCustomer
}) => {
  // Chronological list of Excel workbook sheets
  const EXCEL_SHEETS = [
    '2013-2014',
    '2014-2015',
    '2015-2016',
    '2016-2017',
    '2017-2018',
    '2018-2019',
    '2019-2020',
    '2020-2021',
    '2021-2022',
    '2022-2023',
    '2023-2024',
    '2024-2025',
    '2025-2026',
    '2026-2027'
  ];

  // Merge any custom sheets found in policies
  const allSheetNames = useMemo(() => {
    const set = new Set<string>(EXCEL_SHEETS);
    policies.forEach(p => {
      const s = p.sheetName || p.financialYear;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [policies]);

  // Group policies by financialYear / sheetName
  const sheetGroups = useMemo(() => {
    const map = new Map<string, Policy[]>();

    // Initialize all workbook sheets so they appear in order
    allSheetNames.forEach(sheet => map.set(sheet, []));

    policies.forEach(p => {
      let sheet = p.sheetName || p.financialYear;
      if (!sheet) {
        const yr = p.commencementYear || (p.dateOfCommencement ? new Date(p.dateOfCommencement).getFullYear() : 2024);
        sheet = `${yr}-${yr + 1}`;
      }
      if (!map.has(sheet)) {
        map.set(sheet, []);
      }
      map.get(sheet)!.push(p);
    });

    return Array.from(map.entries()).map(([sheetName, pols]) => {
      // Sort within sheet by ledgerSerialNo or date
      const sorted = [...pols].sort((a, b) => (a.ledgerSerialNo || 0) - (b.ledgerSerialNo || 0));
      const totalSA = sorted.reduce((acc, p) => acc + (Number(p.sumAssured) || 0), 0);
      const totalPremium = sorted.reduce((acc, p) => acc + (Number(p.totalPremium) || 0), 0);
      const inForceCount = sorted.filter(p => p.status === 'IN_FORCE').length;
      const maturedCount = sorted.filter(p => p.status === 'MATURED').length;

      return {
        sheetName,
        policies: sorted,
        totalPolicies: sorted.length,
        totalSA,
        totalPremium,
        inForceCount,
        maturedCount
      };
    });
  }, [policies, allSheetNames]);

  const [selectedSheet, setSelectedSheet] = useState<string>('2024-2025');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('ALL');

  // Active Group for Statistics
  const activeGroup = useMemo(() => {
    if (selectedSheet === 'ALL') {
      const allPols = [...policies].sort((a, b) =>
        new Date(b.dateOfCommencement).getTime() - new Date(a.dateOfCommencement).getTime()
      );
      const totalSA = allPols.reduce((acc, p) => acc + (Number(p.sumAssured) || 0), 0);
      const totalPremium = allPols.reduce((acc, p) => acc + (Number(p.totalPremium) || 0), 0);
      return {
        sheetName: 'All Sheets',
        policies: allPols,
        totalPolicies: allPols.length,
        totalSA,
        totalPremium,
        inForceCount: allPols.filter(p => p.status === 'IN_FORCE').length,
        maturedCount: allPols.filter(p => p.status === 'MATURED').length
      };
    }
    return sheetGroups.find(g => g.sheetName === selectedSheet) || sheetGroups[0];
  }, [sheetGroups, selectedSheet, policies]);

  // Filtered Policies to Display
  const displayPolicies = useMemo(() => {
    if (!activeGroup) return [];
    let list = activeGroup.policies;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.policyNumber.toLowerCase().includes(q) ||
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.customerMobile || '').toLowerCase().includes(q) ||
        p.planName.toLowerCase().includes(q) ||
        p.planNumber.includes(q) ||
        (p.notes || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (selectedStatus !== 'ALL') {
      list = list.filter(p => p.status === selectedStatus);
    }

    // Frequency filter
    if (selectedFrequency !== 'ALL') {
      list = list.filter(p => p.frequency === selectedFrequency);
    }

    return list;
  }, [activeGroup, searchTerm, selectedStatus, selectedFrequency]);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [viewingSchedulePolicy, setViewingSchedulePolicy] = useState<Policy | null>(initialSelectedPolicy || null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inline new customer mode state
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    fullName: '',
    mobile: '',
    city: settings.divisionName || 'Bangalore',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER'
  });

  // Sync initialSelectedPolicy from props
  useEffect(() => {
    if (initialSelectedPolicy) {
      setViewingSchedulePolicy(initialSelectedPolicy);
      const sheet = initialSelectedPolicy.sheetName || initialSelectedPolicy.financialYear;
      if (sheet) {
        setSelectedSheet(sheet);
      }
    }
  }, [initialSelectedPolicy]);

  // Helper to calculate Next Due Date
  const calculateNextDueDate = (doc: string, freq: PremiumFrequency | string): string => {
    if (!doc) return '';
    const d = new Date(doc);
    if (isNaN(d.getTime())) return '';
    switch (freq) {
      case 'YEARLY':
        d.setFullYear(d.getFullYear() + 1);
        break;
      case 'HALF_YEARLY':
        d.setMonth(d.getMonth() + 6);
        break;
      case 'QUARTERLY':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'MONTHLY_NACH':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'SINGLE_PREMIUM':
        return doc;
      default:
        d.setFullYear(d.getFullYear() + 1);
    }
    return d.toISOString().slice(0, 10);
  };

  // Helper to calculate Maturity Date
  const calculateMaturityDate = (doc: string, termYears: number): string => {
    if (!doc || !termYears) return '';
    const d = new Date(doc);
    if (isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + Number(termYears));
    return d.toISOString().slice(0, 10);
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Policy>>({
    policyNumber: '',
    customerId: customers[0]?.id || '',
    customerName: customers[0]?.fullName || '',
    customerMobile: customers[0]?.mobile || '',
    planNumber: '915',
    planName: 'New Jeevan Anand',
    sumAssured: 1000000,
    basicPremium: 45000,
    gstAmount: 2025,
    totalPremium: 47025,
    frequency: 'YEARLY',
    policyTermYears: 20,
    premiumPayingTermYears: 20,
    dateOfCommencement: new Date().toISOString().slice(0, 10),
    dateOfMaturity: '',
    nextDueDate: '',
    status: 'IN_FORCE',
    nomineeName: '',
    nomineeRelationship: 'Spouse',
    branchCode: settings.branchCode || '708',
    agencyCode: settings.agentCode || '0482918X',
    sheetName: '2024-2025',
    financialYear: '2024-2025',
    ledgerSerialNo: 1,
    notes: ''
  });

  // Open Create Form
  const handleOpenCreate = (targetCust?: Customer | null) => {
    setEditingPolicy(null);
    setIsNewCustomerMode(false);
    setNewCustomerData({
      fullName: '',
      mobile: '',
      city: settings.divisionName || 'Bangalore',
      gender: 'MALE'
    });

    // Default financial year: if selectedSheet is specific (not 'ALL'), use it, otherwise current FY
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentFY = currentMonth >= 4 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
    const defaultSheet = (selectedSheet && selectedSheet !== 'ALL') ? selectedSheet : currentFY;

    // Pick start date matching that financial year
    let defaultDoc = now.toISOString().slice(0, 10);
    if (defaultSheet && defaultSheet.includes('-')) {
      const startYr = parseInt(defaultSheet.split('-')[0], 10);
      if (!isNaN(startYr)) {
        defaultDoc = `${startYr}-05-15`;
      }
    }

    const defaultTerm = 20;
    const defaultDOM = calculateMaturityDate(defaultDoc, defaultTerm);
    const defaultNextDue = calculateNextDueDate(defaultDoc, 'YEARLY');

    // Customer
    const cust = targetCust || customers[0];

    // Compute next ledger serial number
    const sheetPolicies = policies.filter(p => (p.sheetName || p.financialYear) === defaultSheet);
    const maxSerial = sheetPolicies.reduce((max, p) => Math.max(max, p.ledgerSerialNo || 0), 0);
    const nextSerial = maxSerial > 0 ? maxSerial + 1 : sheetPolicies.length + 1;

    setFormData({
      policyNumber: '',
      customerId: cust?.id || '',
      customerName: cust?.fullName || '',
      customerMobile: cust?.mobile || '',
      planNumber: '915',
      planName: 'New Jeevan Anand',
      sumAssured: 1000000,
      basicPremium: 45000,
      gstAmount: 2025,
      totalPremium: 47025,
      frequency: 'YEARLY',
      policyTermYears: defaultTerm,
      premiumPayingTermYears: defaultTerm,
      dateOfCommencement: defaultDoc,
      dateOfMaturity: defaultDOM,
      nextDueDate: defaultNextDue,
      status: 'IN_FORCE',
      nomineeName: '',
      nomineeRelationship: 'Spouse',
      branchCode: settings.branchCode || '708',
      agencyCode: settings.agentCode || '0482918X',
      sheetName: defaultSheet,
      financialYear: defaultSheet,
      ledgerSerialNo: nextSerial,
      notes: ''
    });

    setIsFormOpen(true);
  };

  // Sync external isCreateOpen prop
  useEffect(() => {
    if (isCreateOpen) {
      handleOpenCreate(targetCustomer);
    }
  }, [isCreateOpen, targetCustomer]);

  // Open Edit Modal
  const handleOpenEdit = (p: Policy) => {
    setEditingPolicy(p);
    setIsNewCustomerMode(false);
    setFormData({
      ...p,
      sheetName: p.sheetName || p.financialYear || '2024-2025',
      financialYear: p.financialYear || p.sheetName || '2024-2025'
    });
    setIsFormOpen(true);
  };

  // Close form handler
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPolicy(null);
    if (onCloseCreate) {
      onCloseCreate();
    }
  };

  // Financial Year Sheet Change
  const handleSheetChange = (newSheet: string) => {
    const sheetPolicies = policies.filter(p => (p.sheetName || p.financialYear) === newSheet);
    const maxSerial = sheetPolicies.reduce((max, p) => Math.max(max, p.ledgerSerialNo || 0), 0);
    const nextSerial = maxSerial > 0 ? maxSerial + 1 : sheetPolicies.length + 1;

    let updatedDoc = formData.dateOfCommencement;
    if (newSheet && newSheet.includes('-') && updatedDoc) {
      const startYr = parseInt(newSheet.split('-')[0], 10);
      if (!isNaN(startYr)) {
        const docYr = new Date(updatedDoc).getFullYear();
        if (docYr !== startYr && docYr !== startYr + 1) {
          updatedDoc = `${startYr}-05-15`;
        }
      }
    }

    const term = formData.policyTermYears || 20;
    const dom = updatedDoc ? calculateMaturityDate(updatedDoc, term) : formData.dateOfMaturity;
    const nextDue = updatedDoc ? calculateNextDueDate(updatedDoc, formData.frequency || 'YEARLY') : formData.nextDueDate;

    setFormData(prev => ({
      ...prev,
      sheetName: newSheet,
      financialYear: newSheet,
      ledgerSerialNo: nextSerial,
      dateOfCommencement: updatedDoc,
      dateOfMaturity: dom,
      nextDueDate: nextDue
    }));
  };

  // Date of Commencement Change
  const handleDocChange = (newDoc: string) => {
    const term = formData.policyTermYears || 20;
    const dom = calculateMaturityDate(newDoc, term);
    const nextDue = calculateNextDueDate(newDoc, formData.frequency || 'YEARLY');

    let updatedSheet = formData.sheetName;
    if (!editingPolicy && newDoc) {
      const d = new Date(newDoc);
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear();
        const m = d.getMonth() + 1;
        const fy = m >= 4 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
        if (allSheetNames.includes(fy)) {
          updatedSheet = fy;
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      dateOfCommencement: newDoc,
      dateOfMaturity: dom,
      nextDueDate: nextDue,
      sheetName: updatedSheet,
      financialYear: updatedSheet
    }));
  };

  // Policy Term Change
  const handleTermChange = (newTerm: number) => {
    const dom = formData.dateOfCommencement ? calculateMaturityDate(formData.dateOfCommencement, newTerm) : formData.dateOfMaturity;
    setFormData(prev => ({
      ...prev,
      policyTermYears: newTerm,
      premiumPayingTermYears: prev.premiumPayingTermYears === prev.policyTermYears ? newTerm : prev.premiumPayingTermYears,
      dateOfMaturity: dom
    }));
  };

  // Payment Frequency Change
  const handleFrequencyChange = (newFreq: PremiumFrequency) => {
    const nextDue = formData.dateOfCommencement ? calculateNextDueDate(formData.dateOfCommencement, newFreq) : formData.nextDueDate;
    const gstRate = newFreq === 'SINGLE_PREMIUM' ? 0.018 : 0.045;
    const bp = Number(formData.basicPremium || 0);
    const gst = Math.round(bp * gstRate);
    setFormData(prev => ({
      ...prev,
      frequency: newFreq,
      nextDueDate: nextDue,
      gstAmount: gst,
      totalPremium: bp + gst
    }));
  };

  // Basic Premium Change
  const handleBasicPremiumChange = (bp: number) => {
    const gstRate = formData.frequency === 'SINGLE_PREMIUM' ? 0.018 : 0.045;
    const gst = Math.round(bp * gstRate);
    setFormData(prev => ({
      ...prev,
      basicPremium: bp,
      gstAmount: gst,
      totalPremium: bp + gst
    }));
  };

  // Plan Selection handler
  const handlePlanSelect = (tableNo: string) => {
    const plan = LIC_POPULAR_PLANS.find(p => p.tableNo === tableNo);
    if (plan) {
      const term = plan.typicalTerms[0] || 20;
      const docDate = formData.dateOfCommencement ? new Date(formData.dateOfCommencement) : new Date();
      const domDate = new Date(docDate);
      domDate.setFullYear(domDate.getFullYear() + term);

      setFormData(prev => ({
        ...prev,
        planNumber: plan.tableNo,
        planName: plan.name,
        policyTermYears: term,
        premiumPayingTermYears: term,
        dateOfMaturity: domDate.toISOString().slice(0, 10)
      }));
    }
  };

  // Customer Selection handler
  const handleCustomerSelect = (custId: string) => {
    if (custId === '__NEW__') {
      setIsNewCustomerMode(true);
      return;
    }
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setFormData(prev => ({
        ...prev,
        customerId: cust.id,
        customerName: cust.fullName,
        customerMobile: cust.mobile
      }));
    }
  };

  // Form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.policyNumber || !formData.policyNumber.trim()) {
      alert('Please fill in a valid Policy Number.');
      return;
    }

    let customerId = formData.customerId;
    let customerName = formData.customerName || '';
    let customerMobile = formData.customerMobile || '';

    // Handle inline new customer creation
    if (isNewCustomerMode) {
      if (!newCustomerData.fullName.trim() || !newCustomerData.mobile.trim()) {
        alert('Please enter customer full name and mobile number.');
        return;
      }

      const newCustObj: Customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fullName: newCustomerData.fullName.trim(),
        mobile: newCustomerData.mobile.trim(),
        city: newCustomerData.city || settings.divisionName || 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        dateOfBirth: '1985-01-01',
        gender: newCustomerData.gender || 'MALE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (onSaveCustomer) {
        const saved = await onSaveCustomer(newCustObj);
        customerId = saved.id;
        customerName = saved.fullName;
        customerMobile = saved.mobile;
      } else {
        customerId = newCustObj.id;
        customerName = newCustObj.fullName;
        customerMobile = newCustObj.mobile;
      }
    } else {
      if (!customerId) {
        alert('Please select a Policyholder from the dropdown, or choose "Add New Policyholder".');
        return;
      }
      const cust = customers.find(c => c.id === customerId);
      if (cust) {
        customerName = cust.fullName;
        customerMobile = cust.mobile;
      }
    }

    const docYear = formData.dateOfCommencement
      ? new Date(formData.dateOfCommencement).getFullYear()
      : (formData.sheetName ? parseInt(formData.sheetName.split('-')[0], 10) : new Date().getFullYear());
    const sheetName = formData.sheetName || (selectedSheet !== 'ALL' ? selectedSheet : `${docYear}-${docYear + 1}`);

    const toSave: Policy = {
      ...(formData as Policy),
      id: editingPolicy?.id || `pol-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customerId: customerId || 'cust-generic',
      customerName: customerName,
      customerMobile: customerMobile,
      totalPremium: Number(formData.totalPremium || (Number(formData.basicPremium || 0) + Number(formData.gstAmount || 0))),
      basicPremium: Number(formData.basicPremium || 0),
      gstAmount: Number(formData.gstAmount || 0),
      sumAssured: Number(formData.sumAssured || 0),
      commencementYear: docYear,
      financialYear: sheetName,
      sheetName: sheetName,
      policyTermYears: Number(formData.policyTermYears || 20),
      premiumPayingTermYears: Number(formData.premiumPayingTermYears || 20),
      ledgerSerialNo: Number(formData.ledgerSerialNo) || undefined,
      createdAt: editingPolicy?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSubmitting(true);
    try {
      await onSavePolicy(toSave);

      // Select that sheet so the new policy is immediately visible
      setSelectedSheet(sheetName);

      // Show success toast
      setToastMessage(
        editingPolicy
          ? `Policy #${toSave.policyNumber} updated successfully!`
          : `Policy #${toSave.policyNumber} successfully registered into ${sheetName} Ledger!`
      );
      setTimeout(() => setToastMessage(null), 4500);

      handleCloseForm();
    } catch (err) {
      console.error('Failed to save policy:', err);
      alert('Error saving policy to database: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 600,
          animation: 'modalEnter 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} color="#a7f3d0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', marginLeft: '6px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}


      {/* Independent Search Bar at Top */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
          type="text"
          placeholder="Search client, policy, plan, mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
          style={{
            width: '100%',
            paddingLeft: '40px',
            paddingRight: searchTerm ? '38px' : '14px',
            paddingTop: '9px',
            paddingBottom: '9px',
            fontSize: '13.5px',
            height: '42px',
            borderRadius: '10px',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Independent Filter Dropdowns (Status + Frequency) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <CustomSelect
          value={selectedStatus}
          onChange={(val) => setSelectedStatus(val)}
          options={[
            { value: 'ALL', label: 'All Statuses' },
            { value: 'IN_FORCE', label: 'In Force' },
            { value: 'LAPSED', label: 'Lapsed' },
            { value: 'PAID_UP', label: 'Paid Up' },
            { value: 'MATURED', label: 'Matured' },
            { value: 'CLAIM_PAID', label: 'Claim Paid' }
          ]}
          style={{ flex: 1 }}
          buttonStyle={{ height: '38px', fontSize: '12.5px' }}
        />

        <CustomSelect
          value={selectedFrequency}
          onChange={(val) => setSelectedFrequency(val)}
          options={[
            { value: 'ALL', label: 'All Payment Modes' },
            { value: 'YEARLY', label: 'Yearly' },
            { value: 'HALF_YEARLY', label: 'Half-Yearly' },
            { value: 'QUARTERLY', label: 'Quarterly' },
            { value: 'MONTHLY_NACH', label: 'Monthly (NACH)' },
            { value: 'SINGLE_PREMIUM', label: 'Single Premium' }
          ]}
          style={{ flex: 1 }}
          buttonStyle={{ height: '38px', fontSize: '12.5px' }}
        />

        {(searchTerm || selectedStatus !== 'ALL' || selectedFrequency !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedStatus('ALL');
              setSelectedFrequency('ALL');
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 12px',
              height: '38px',
              whiteSpace: 'nowrap'
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Independent Year Filter: Horizontal Swipeable Chips */}
      <div className="horizontal-scroll-chips" style={{ padding: '0 2px 2px 2px' }}>
        {sheetGroups.map(group => {
          const isSelected = selectedSheet === group.sheetName;
          return (
            <button
              key={group.sheetName}
              type="button"
              onClick={() => {
                setSelectedSheet(group.sheetName);
                setSearchTerm('');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 13px',
                borderRadius: 'var(--radius-full)',
                background: isSelected
                  ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
                  : 'var(--bg-card, #ffffff)',
                border: isSelected ? '1px solid #1d4ed8' : '1px solid var(--border-color)',
                color: isSelected ? '#ffffff' : 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{group.sheetName}</span>
              <span style={{
                fontSize: '11px',
                background: isSelected ? 'rgba(255, 255, 255, 0.28)' : 'rgba(15, 23, 42, 0.08)',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {group.totalPolicies}
              </span>
            </button>
          );
        })}

        {/* All Sheets Pill */}
        <button
          type="button"
          onClick={() => {
            setSelectedSheet('ALL');
            setSearchTerm('');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 13px',
            borderRadius: 'var(--radius-full)',
            background: selectedSheet === 'ALL'
              ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
              : 'var(--bg-card, #ffffff)',
            border: selectedSheet === 'ALL' ? '1px solid #b45309' : '1px solid var(--border-color)',
            color: selectedSheet === 'ALL' ? '#ffffff' : 'var(--text-main)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: selectedSheet === 'ALL' ? '0 2px 8px rgba(217, 119, 6, 0.25)' : 'var(--shadow-sm)',
            transition: 'all 0.15s ease'
          }}
        >
          <span>All Sheets</span>
          <span style={{
            fontSize: '11px',
            background: selectedSheet === 'ALL' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(15, 23, 42, 0.08)',
            padding: '1px 6px',
            borderRadius: '10px',
            fontWeight: 700
          }}>
            {policies.length}
          </span>
        </button>
      </div>

      {/* Exactly 2 KPI Statistics Cards: Volume & Total Sum Assured */}
      {activeGroup && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {/* Card 1: Volume */}
          <div className="stat-card" style={{ '--stat-accent': '#2563eb' } as React.CSSProperties}>
            <div>
              <div className="stat-label">VOLUME ({activeGroup.sheetName})</div>
              <div className="stat-val">{activeGroup.totalPolicies} Policies</div>
              <div className="stat-sub">
                <span style={{ color: '#059669', fontWeight: 600 }}>{activeGroup.inForceCount} In-Force</span>
                {activeGroup.maturedCount > 0 && (
                  <span> • <span style={{ color: '#64748b' }}>{activeGroup.maturedCount} Matured</span></span>
                )}
              </div>
            </div>
            <div style={{
              background: 'rgba(37, 99, 235, 0.1)',
              padding: '10px',
              borderRadius: '10px'
            }}>
              <FileCheck2 size={20} color="#2563eb" />
            </div>
          </div>

          {/* Card 2: Total Sum Assured */}
          <div className="stat-card" style={{ '--stat-accent': '#059669' } as React.CSSProperties}>
            <div>
              <div className="stat-label">TOTAL SUM ASSURED</div>
              <div className="stat-val" style={{ color: '#0f172a' }}>{formatINR(activeGroup.totalSA)}</div>
              <div className="stat-sub">Life cover assured</div>
            </div>
            <div style={{
              background: 'rgba(5, 150, 105, 0.1)',
              padding: '10px',
              borderRadius: '10px'
            }}>
              <Shield size={20} color="#059669" />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Card View (< 768px): Each policy container has 100% width matching top container */}
      {activeGroup && (
        <div className="mobile-card-view" style={{ padding: 0, gap: '12px' }}>
          {displayPolicies.length === 0 ? (
            <div className="lic-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No policy records match your search and filter criteria.
            </div>
          ) : (
            displayPolicies.map((pol) => {
              const isProposal = pol.policyNumber.startsWith('PROP-');
              const isMatured = pol.status === 'MATURED';
              const planLabel = pol.planName.includes(pol.planNumber)
                ? pol.planName
                : `${pol.planName} (${pol.planNumber})`;

              return (
                <div
                  key={pol.id}
                  onClick={() => setViewingSchedulePolicy(pol)}
                  className="lic-card"
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s ease'
                  }}
                >
                  {/* Card Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        background: 'var(--bg-elevated)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        #{pol.ledgerSerialNo || pol.id.replace('pol-', '')}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '13.5px', color: isProposal ? '#b45309' : '#2563eb' }}>
                        {isProposal ? `${pol.policyNumber} (Proposal)` : maskPolicyNum(pol.policyNumber)}
                      </span>
                    </div>
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

                  {/* Card Actions Footer: Customer 360 & Schedule removed */}
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
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(pol)}
                        style={{ padding: '4px 10px', fontSize: '11.5px', gap: '4px' }}
                        title="Edit Policy"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteConfirmId(pol.id)}
                        style={{ padding: '4px 10px', fontSize: '11.5px', gap: '4px' }}
                        title="Delete Policy"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Desktop Full Table View (>= 769px) */}
      {activeGroup && (
        <div className="desktop-table-view lic-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="lic-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.No</th>
                <th>Policy No.</th>
                <th>Client Name & Details</th>
                <th>Contact Number</th>
                <th>Plan & Term</th>
                <th>Sum Assured</th>
                <th>Payment Mode</th>
                <th>DOC</th>
                <th>Next Due / Maturity</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayPolicies.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No policy records match your search in sheet {activeGroup.sheetName}.
                  </td>
                </tr>
              ) : (
                displayPolicies.map((pol) => {
                  const isProposal = pol.policyNumber.startsWith('PROP-');
                  const planTermCode = `${pol.planNumber}-${pol.policyTermYears}-${pol.premiumPayingTermYears}`;

                  return (
                    <tr
                      key={pol.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setViewingSchedulePolicy(pol)}
                      title="Click to view full policy schedule certificate"
                    >
                      <td className="mono-text" style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 600 }}>
                        {pol.ledgerSerialNo || pol.id.replace('pol-', '')}
                      </td>
                      <td className="mono-text">
                        {isProposal ? (
                          <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {pol.policyNumber} (Proposal)
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, color: '#2563eb' }}>
                            {maskPolicyNum(pol.policyNumber)}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCustomer(pol.customerId);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: 0
                          }}
                          title="View Customer 360"
                        >
                          {pol.customerName}
                        </button>
                        {pol.notes && (
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            maxWidth: '240px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {pol.notes.replace(/^Physical Ledger:.*?Entry in notebook: /i, '').replace(/["']/g, '')}
                          </div>
                        )}
                      </td>
                      <td className="mono-text" style={{ fontSize: '12px' }}>
                        {pol.customerMobile || '-'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '12px' }}>{pol.planName}</div>
                        <div className="mono-text" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          Code: {planTermCode}
                        </div>
                      </td>
                      <td className="mono-text" style={{ fontWeight: 600 }}>
                        {formatINR(pol.sumAssured)}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          fontWeight: 600
                        }}>
                          {pol.frequency.replace('_', ' ')}
                        </span>
                        <div className="mono-text" style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
                          {formatINR(pol.totalPremium)}
                        </div>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {formatDate(pol.dateOfCommencement)}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {pol.status === 'MATURED' ? (
                          <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} />
                            <span>{formatDate(pol.dateOfMaturity)}</span>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={13} color="#d97706" />
                            <span>{formatDate(pol.nextDueDate)}</span>
                          </span>
                        )}
                      </td>
                      <td>
                        {getStatusBadge(pol.status)}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setViewingSchedulePolicy(pol)}
                            title="View & Print Policy Schedule / Certificate"
                          >
                            <Printer size={13} color="#3b82f6" />
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(pol)}
                            title="Edit Policy"
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteConfirmId(pol.id)}
                            title="Delete Policy"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
                Are you sure you want to delete this policy record? This action will be recorded in the audit trail.
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
                    await onDeletePolicy(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
              >
                Delete Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Register Policy Modal Form */}
      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={20} color="#d97706" />
                    <span>{editingPolicy ? `Edit Policy #${editingPolicy.policyNumber}` : 'Register New Policy'}</span>
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
                    {editingPolicy ? 'Update policy schedule and ledger particulars' : 'Fill in all policyholder and plan particulars to record into register ledger'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

                  {/* 1. Financial Year / Register Sheet */}
                  <div className="form-group" style={{ background: 'rgba(37, 99, 235, 0.04)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                    <label className="form-label" style={{ color: '#1d4ed8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      <span>Register Financial Year (Sheet) *</span>
                    </label>
                    <CustomSelect
                      required
                      value={formData.sheetName || '2024-2025'}
                      onChange={(val) => handleSheetChange(val)}
                      options={allSheetNames.map(sheet => ({
                        value: sheet,
                        label: `Financial Year ${sheet} Register`
                      }))}
                      buttonStyle={{ fontWeight: 600, borderColor: '#93c5fd' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                      Policy will be recorded into this specific financial year workbook ledger.
                    </span>
                  </div>

                  {/* 2. Ledger Serial Number */}
                  <div className="form-group" style={{ background: 'rgba(37, 99, 235, 0.04)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                    <label className="form-label" style={{ color: '#1d4ed8', fontWeight: 700 }}>
                      Ledger S.No (Workbook Serial)
                    </label>
                    <input
                      type="number"
                      className="form-input mono-text"
                      value={formData.ledgerSerialNo || ''}
                      onChange={(e) => setFormData({ ...formData, ledgerSerialNo: Number(e.target.value) })}
                      placeholder="e.g. 1"
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                      Entry row position within this sheet's physical register.
                    </span>
                  </div>

                  {/* 3. Policy Number */}
                  <div className="form-group">
                    <label className="form-label">Policy Number (9 Digits) *</label>
                    <input
                      type="text"
                      className="form-input mono-text"
                      required
                      value={formData.policyNumber || ''}
                      onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                      placeholder="e.g. 883904122 or PROP-2024-001"
                      style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em' }}
                    />
                  </div>

                  {/* 4. Policy Status */}
                  <div className="form-group">
                    <label className="form-label">Policy Status *</label>
                    <CustomSelect
                      value={formData.status || 'IN_FORCE'}
                      onChange={(val) => setFormData({ ...formData, status: val as PolicyStatus })}
                      options={[
                        { value: 'IN_FORCE', label: 'In Force (Active Policy)', badge: 'Active' },
                        { value: 'LAPSED', label: 'Lapsed (Unpaid / Overdue)', badge: 'Overdue' },
                        { value: 'PAID_UP', label: 'Paid Up (Reduced Benefit)' },
                        { value: 'MATURED', label: 'Matured (Completed Term)' },
                        { value: 'CLAIM_PAID', label: 'Claim Paid (Settled)' }
                      ]}
                    />
                  </div>

                  {/* 5. Policyholder Selection or New Customer */}
                  <div className="form-group" style={{ gridColumn: '1 / -1', background: 'var(--bg-card, #ffffff)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                        Policyholder / Customer Details *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsNewCustomerMode(!isNewCustomerMode)}
                        style={{
                          background: isNewCustomerMode ? '#f1f5f9' : 'rgba(217, 119, 6, 0.1)',
                          border: isNewCustomerMode ? '1px solid #cbd5e1' : '1px solid rgba(217, 119, 6, 0.3)',
                          color: isNewCustomerMode ? 'var(--text-main)' : '#b45309',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        {isNewCustomerMode ? (
                          <>
                            <User size={13} />
                            <span>Select Existing Policyholder</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={13} />
                            <span>+ Add New Policyholder</span>
                          </>
                        )}
                      </button>
                    </div>

                    {!isNewCustomerMode ? (
                      <div>
                        <CustomSelect
                          value={formData.customerId || ''}
                          onChange={(val) => handleCustomerSelect(val)}
                          placeholder={`-- Select Existing Policyholder (${customers.length} Available) --`}
                          options={[
                            { value: '__NEW__', label: '+ Enter New Policyholder Details...' },
                            ...customers.map(c => ({
                              value: c.id,
                              label: c.fullName,
                              sublabel: `Mob: ${c.mobile} • ${c.city}`
                            }))
                          ]}
                        />
                        {formData.customerName && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '5px' }}>
                            Selected Client: <strong style={{ color: 'var(--text-main)' }}>{formData.customerName}</strong> ({formData.customerMobile})
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', background: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Full Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            required={isNewCustomerMode}
                            value={newCustomerData.fullName}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, fullName: e.target.value })}
                            placeholder="e.g. Ramesh Kumar Sharma"
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Mobile Number (10 Digits) *</label>
                          <input
                            type="tel"
                            className="form-input mono-text"
                            required={isNewCustomerMode}
                            value={newCustomerData.mobile}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, mobile: e.target.value })}
                            placeholder="e.g. 9845012345"
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>City / Town</label>
                          <input
                            type="text"
                            className="form-input"
                            value={newCustomerData.city}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, city: e.target.value })}
                            placeholder="e.g. Bangalore"
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Gender</label>
                          <CustomSelect
                            value={newCustomerData.gender}
                            onChange={(val) => setNewCustomerData({ ...newCustomerData, gender: val as 'MALE' | 'FEMALE' | 'OTHER' })}
                            options={[
                              { value: 'MALE', label: 'Male' },
                              { value: 'FEMALE', label: 'Female' },
                              { value: 'OTHER', label: 'Other' }
                            ]}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 6. Plan Selection */}
                  <div className="form-group">
                    <label className="form-label">LIC Plan / Table *</label>
                    <CustomSelect
                      value={formData.planNumber || '915'}
                      onChange={(val) => handlePlanSelect(val)}
                      options={LIC_POPULAR_PLANS.map(p => ({
                        value: p.tableNo,
                        label: `Table ${p.tableNo} - ${p.name}`,
                        badge: p.category
                      }))}
                    />
                  </div>

                  {/* 7. Sum Assured */}
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="form-label">Sum Assured (₹) *</label>
                      <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>
                        {formatINR(formData.sumAssured || 0)}
                      </span>
                    </div>
                    <input
                      type="number"
                      className="form-input mono-text"
                      required
                      value={formData.sumAssured || ''}
                      onChange={(e) => setFormData({ ...formData, sumAssured: Number(e.target.value) })}
                      placeholder="e.g. 500000"
                    />
                  </div>

                  {/* 8. Payment Frequency */}
                  <div className="form-group">
                    <label className="form-label">Payment Mode / Frequency *</label>
                    <CustomSelect
                      value={formData.frequency || 'YEARLY'}
                      onChange={(val) => handleFrequencyChange(val as PremiumFrequency)}
                      options={[
                        { value: 'YEARLY', label: 'Yearly (Annual)' },
                        { value: 'HALF_YEARLY', label: 'Half-Yearly (Semi-Annual)' },
                        { value: 'QUARTERLY', label: 'Quarterly' },
                        { value: 'MONTHLY_NACH', label: 'Monthly (NACH Auto Debit)' },
                        { value: 'SINGLE_PREMIUM', label: 'Single Premium (One Time)' }
                      ]}
                    />
                  </div>

                  {/* 9. Basic Premium */}
                  <div className="form-group">
                    <label className="form-label">Basic Premium (₹)</label>
                    <input
                      type="number"
                      className="form-input mono-text"
                      value={formData.basicPremium || ''}
                      onChange={(e) => handleBasicPremiumChange(Number(e.target.value))}
                      placeholder="e.g. 25000"
                    />
                  </div>

                  {/* 10. GST Amount */}
                  <div className="form-group">
                    <label className="form-label">GST / Tax Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input mono-text"
                      value={formData.gstAmount || ''}
                      onChange={(e) => {
                        const gst = Number(e.target.value);
                        setFormData({
                          ...formData,
                          gstAmount: gst,
                          totalPremium: Number(formData.basicPremium || 0) + gst
                        });
                      }}
                      placeholder="Auto computed"
                    />
                  </div>

                  {/* 11. Total Installment Premium */}
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="form-label">Total Premium (₹) *</label>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                        {formatINR(formData.totalPremium || 0)}
                      </span>
                    </div>
                    <input
                      type="number"
                      className="form-input mono-text"
                      required
                      value={formData.totalPremium || ''}
                      onChange={(e) => setFormData({ ...formData, totalPremium: Number(e.target.value) })}
                      placeholder="e.g. 26125"
                      style={{ fontWeight: 700 }}
                    />
                  </div>

                  {/* 12. Policy Term & PPT */}
                  <div className="form-group">
                    <label className="form-label">Policy Term (Years)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.policyTermYears || 20}
                      onChange={(e) => handleTermChange(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Premium Paying Term (PPT)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.premiumPayingTermYears || 20}
                      onChange={(e) => setFormData({ ...formData, premiumPayingTermYears: Number(e.target.value) })}
                    />
                  </div>

                  {/* 13. Date of Commencement */}
                  <div className="form-group">
                    <label className="form-label">Date of Commencement (DOC) *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={formData.dateOfCommencement || ''}
                      onChange={(e) => handleDocChange(e.target.value)}
                    />
                  </div>

                  {/* 14. Next Due Date */}
                  <div className="form-group">
                    <label className="form-label">Next Premium Due Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.nextDueDate || ''}
                      onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                    />
                  </div>

                  {/* 15. Date of Maturity */}
                  <div className="form-group">
                    <label className="form-label">Date of Maturity (DOM)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.dateOfMaturity || ''}
                      onChange={(e) => setFormData({ ...formData, dateOfMaturity: e.target.value })}
                    />
                  </div>

                  {/* 16. Nominee Details */}
                  <div className="form-group">
                    <label className="form-label">Nominee Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.nomineeName || ''}
                      onChange={(e) => setFormData({ ...formData, nomineeName: e.target.value })}
                      placeholder="e.g. Suman Sharma"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nominee Relationship</label>
                    <CustomSelect
                      value={formData.nomineeRelationship || 'Spouse'}
                      onChange={(val) => setFormData({ ...formData, nomineeRelationship: val })}
                      options={[
                        { value: 'Spouse', label: 'Spouse' },
                        { value: 'Husband', label: 'Husband' },
                        { value: 'Wife', label: 'Wife' },
                        { value: 'Son', label: 'Son' },
                        { value: 'Daughter', label: 'Daughter' },
                        { value: 'Father', label: 'Father' },
                        { value: 'Mother', label: 'Mother' },
                        { value: 'Brother', label: 'Brother' },
                        { value: 'Sister', label: 'Sister' },
                        { value: 'Other', label: 'Other' }
                      ]}
                    />
                  </div>

                  {/* 17. Agency & Branch */}
                  <div className="form-group">
                    <label className="form-label">Branch Code</label>
                    <input
                      type="text"
                      className="form-input mono-text"
                      value={formData.branchCode || ''}
                      onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                      placeholder="e.g. 708"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Agency Code</label>
                    <input
                      type="text"
                      className="form-input mono-text"
                      value={formData.agencyCode || ''}
                      onChange={(e) => setFormData({ ...formData, agencyCode: e.target.value })}
                      placeholder="e.g. 0482918X"
                    />
                  </div>

                  {/* 18. Notes */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Register Notes / Ledger Page Reference</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="e.g. Physical register Vol 24 / Page 82. First premium paid by cheque."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseForm} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  {isSubmitting ? (
                    <span>Saving to Database...</span>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{editingPolicy ? 'Update Policy Record' : `Save Policy to ${formData.sheetName || 'Register'}`}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Policy Certificate / Schedule Printable Modal */}
      {viewingSchedulePolicy && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div className="modal-header no-print">
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} color="#2563eb" />
                Policy Record Schedule Certificate
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  onClick={async () => {
                    const ok = await generatePolicySchedulePDF(viewingSchedulePolicy, settings);
                    if (ok) {
                      setToastMessage(`Policy Schedule PDF for #${viewingSchedulePolicy.policyNumber} ready!`);
                      setTimeout(() => setToastMessage(null), 4000);
                    }
                  }}
                  style={{ gap: '6px' }}
                  title="Save PDF / Print"
                >
                  <Printer size={14} />
                  <span>Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSchedulePolicy(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Printable Document Sheet */}
              <div
                className="printable-document"
                style={{
                  background: '#ffffff',
                  color: '#111827',
                  padding: '32px 28px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)'
                }}
              >
                {/* Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#b45309', fontWeight: 800 }}>
                    Life Insurance Corporation of India
                  </div>
                  <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a', margin: '4px 0', letterSpacing: '0.01em' }}>
                    POLICY SCHEDULE & PARTICULARS
                  </h1>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Branch Office: {viewingSchedulePolicy.branchCode || settings.branchCode} • Agency: {viewingSchedulePolicy.agencyCode || settings.agentCode} ({settings.agentName})
                  </div>
                </div>

                {/* Table Data */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569', width: '38%' }}>Policy Number:</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, fontSize: '15px', color: '#1e3a8a', fontFamily: 'monospace' }}>
                        {viewingSchedulePolicy.policyNumber}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Name of Life Assured:</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, fontSize: '14.5px', color: '#0f172a' }}>
                        {viewingSchedulePolicy.customerName}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Plan & Table:</td>
                      <td style={{ padding: '9px 12px', color: '#1e293b', fontWeight: 600 }}>
                        Table {viewingSchedulePolicy.planNumber} - {viewingSchedulePolicy.planName}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Sum Assured:</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#047857', fontSize: '14px' }}>
                        {formatINR(viewingSchedulePolicy.sumAssured)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Installment Premium:</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#0f172a' }}>
                        {formatINR(viewingSchedulePolicy.totalPremium)} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>({formatFrequencyLabel(viewingSchedulePolicy.frequency)})</span>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Policy Term / PPT:</td>
                      <td style={{ padding: '9px 12px', color: '#334155' }}>
                        Term: {viewingSchedulePolicy.policyTermYears} Years / PPT: {viewingSchedulePolicy.premiumPayingTermYears} Years
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Date of Commencement (DOC):</td>
                      <td style={{ padding: '9px 12px', color: '#334155', fontWeight: 600 }}>
                        {formatDate(viewingSchedulePolicy.dateOfCommencement)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Date of Maturity:</td>
                      <td style={{ padding: '9px 12px', color: '#334155', fontWeight: 600 }}>
                        {formatDate(viewingSchedulePolicy.dateOfMaturity)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Next Renewal Due Date:</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#b45309' }}>
                        {formatDate(viewingSchedulePolicy.nextDueDate)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Nominee Details:</td>
                      <td style={{ padding: '9px 12px', color: '#334155' }}>
                        {viewingSchedulePolicy.nomineeName || 'As per record'} ({viewingSchedulePolicy.nomineeRelationship})
                      </td>
                    </tr>
                    <tr style={{ background: '#f8fafc' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#475569' }}>Current Status:</td>
                      <td style={{ padding: '9px 12px' }}>
                        {getStatusBadge(viewingSchedulePolicy.status)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Clean Professional Footer */}
                <div style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '11.5px' }}>
                      Official Policy Schedule Certificate
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: '3px' }}>
                      Generated on: {formatDate(new Date().toISOString())}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '160px' }}>
                    <div style={{ borderBottom: '1.5px solid #0f172a', width: '150px', margin: '0 auto 6px' }} />
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '11.5px' }}>
                      {settings.agentName || 'Life Insurance Advisor'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Authorized Agent / Consultant</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions for Mobile */}
            <div className="no-print" style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              borderBottomLeftRadius: '14px',
              borderBottomRightRadius: '14px'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingSchedulePolicy(null)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={async () => {
                  const ok = await generatePolicySchedulePDF(viewingSchedulePolicy, settings);
                  if (ok) {
                    setToastMessage(`Policy Schedule PDF for #${viewingSchedulePolicy.policyNumber} saved!`);
                    setTimeout(() => setToastMessage(null), 4000);
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontWeight: 700, fontSize: '13px' }}
              >
                <Printer size={15} />
                <span>Save PDF to Mobile</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
