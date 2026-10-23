import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';
import Swal from 'sweetalert2';
import { DOMAIN, API_BASE_URL } from '../config/api';

const AppointlmentList = () => {
  const navigate = useNavigate();

  // Helper to dynamically get current base URL
  const getApiBase = () => (DOMAIN || API_BASE_URL || '').replace(/\/+$/, '');

  // Helper to extract clean human-readable agent code (e.g. AG001), NEVER a 24-char MongoDB ObjectId
  const getAgentCode = () => {
    const auid = (localStorage.getItem('AUID') || '').trim();
    if (auid && !/^[a-f\d]{24}$/i.test(auid)) return auid;
    const acode = (localStorage.getItem('agentCode') || '').trim();
    if (acode && !/^[a-f\d]{24}$/i.test(acode)) return acode;
    return 'AG001';
  };

  // Agent State
  const [agentId, setAgentId] = useState(getAgentCode());

  // Payment Status filter: '' (all), 'paid', 'link generated'
  const [statusFilter, setStatusFilter] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Date Filters
  const [fromDate, setFromDate] = useState(moment().startOf('month').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(moment().add(1, 'day').format('YYYY-MM-DD'));

  // Data State
  const [appointments, setAppointments] = useState([]);
  const [doctorsMap, setDoctorsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Details
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Agent Markup State (Channel Partner Markup)
  const [agentMarkup, setAgentMarkup] = useState(() => {
    const cached = sessionStorage.getItem('c2c_agent_markup') || localStorage.getItem('c2c_agent_markup');
    return cached ? Number(cached) : 52;
  });

  // Fetch agent markup from /badri_enterprises/localprime/saving-wallet/details
  const fetchAgentMarkup = async () => {
    try {
      const rawAgentCode = getAgentCode();
      const base = getApiBase();
      const headers = base.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {};

      let mongoId = localStorage.getItem('agent_id');
      if (!mongoId || !/^[a-f\d]{24}$/i.test(mongoId)) {
        try {
          const limitRes = await axios.get(`${base}/badri_enterprises/localprime/wallet/list`, {
            timeout: 20000,
            headers
          });
          const wallets = limitRes.data?.data || [];
          const match = wallets.find(
            (w) =>
              (w.agentCode || '').toLowerCase() === rawAgentCode.toLowerCase() ||
              (w.agent_id || '').toLowerCase() === rawAgentCode.toLowerCase()
          );
          if (match?.agent_id) {
            mongoId = match.agent_id;
            localStorage.setItem('agent_id', mongoId);
          }
        } catch (_) {}
      }

      if (mongoId) {
        const detailsRes = await axios.get(
          `${base}/badri_enterprises/localprime/saving-wallet/details?agent_id=${mongoId}`,
          { timeout: 20000, headers }
        );
        if (detailsRes.data?.success && detailsRes.data?.data?.agent) {
          const m = detailsRes.data.data.agent.markup_amount;
          if (m !== undefined && m !== null) {
            const num = Number(m);
            setAgentMarkup(num);
            try {
              sessionStorage.setItem('c2c_agent_markup', String(num));
              localStorage.setItem('c2c_agent_markup', String(num));
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch agent markup:', e.message);
    }
  };

  // Fetch doctors list for doctor name lookup (cached in sessionStorage to avoid 1MB re-downloads)
  const fetchDoctors = async () => {
    try {
      const cached = sessionStorage.getItem('c2c_cached_doctors');
      if (cached) {
        try {
          const map = JSON.parse(cached);
          if (Object.keys(map).length > 0) setDoctorsMap(map);
        } catch (_) {}
      }

      const base = getApiBase();
      const isNgrok = base.includes('ngrok');
      const headers = isNgrok ? { 'ngrok-skip-browser-warning': 'true' } : {};

      const res = await axios.get(`${base}/c2c_app/doctors`, {
        timeout: 45000,
        headers
      });
      if (res.data && Array.isArray(res.data.data)) {
        const map = {};
        res.data.data.forEach((doc) => {
          if (doc._id) map[doc._id] = doc;
          if (doc.phonenumberID) map[doc.phonenumberID] = doc;
          if (doc.doctorId) map[doc.doctorId] = doc;
          if (doc.mongoid) map[doc.mongoid] = doc;
          if (doc.id) map[doc.id] = doc;
        });
        setDoctorsMap(map);
        try {
          sessionStorage.setItem('c2c_cached_doctors', JSON.stringify(map));
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Could not fetch doctors list for mapping:', err.message);
    }
  };

  // Fetch appointments from API: GET /c2c_app/appointments/agent/{agent_id}?payment_status=...&created_from=...&created_to=...
  const fetchAppointments = async (
    overrideFrom = fromDate,
    overrideTo = toDate,
    overrideStatus = statusFilter,
    isManualRefresh = false
  ) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = {};
      if (overrideFrom) params.created_from = overrideFrom;
      if (overrideTo) params.created_to = overrideTo;
      if (overrideStatus && overrideStatus !== 'all') {
        params.payment_status = overrideStatus;
      }

      const targetAgent = getAgentCode();
      const base = getApiBase();
      const isNgrok = base.includes('ngrok');
      const headers = isNgrok ? { 'ngrok-skip-browser-warning': 'true' } : {};

      console.log(`[Appointments] GET -> ${base}/c2c_app/appointments/agent/${targetAgent}`, params);

      const res = await axios.get(`${base}/c2c_app/appointments/agent/${targetAgent}`, {
        params,
        timeout: 45000,
        headers
      });

      if (res.data && res.data.success) {
        setAppointments(res.data.data || []);
      } else if (res.data && Array.isArray(res.data.data)) {
        setAppointments(res.data.data);
      } else {
        setAppointments([]);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      const base = getApiBase();
      const msg = err.message === 'Network Error'
        ? `Unable to connect to server at ${base}. Please verify backend server is running.`
        : err.response?.data?.message || err.message || 'Failed to fetch appointments';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Copy payment link helper
  const handleCopyPaymentLink = async (link, id) => {
    if (!link) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Payment Link Copied!',
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Parse any value or MongoDB BSON object safely
  const parseNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    if (typeof val === 'object') {
      if (val.$numberDouble !== undefined) return parseFloat(val.$numberDouble) || fallback;
      if (val.$numberInt !== undefined) return parseInt(val.$numberInt, 10) || fallback;
      if (val.$numberDecimal !== undefined) return parseFloat(val.$numberDecimal) || fallback;
    }
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? fallback : num;
  };

  // Detailed fee breakdown: extracts amount, channel partner markup, and total = amount + markup_amount
  const getAppointmentFeeBreakdown = (item) => {
    if (!item) return { docFee: 0, markup: 0, total: 0 };

    const docFee = parseNum(item.amount) || parseNum(item.doctor_fee) || parseNum(item.fee) || 0;
    const markup = parseNum(item.markup_amount) || 0;
    const total = docFee + markup;

    return { docFee, markup, total };
  };

  // Helper returning total payable amount
  const getAppointmentAmount = (item) => {
    const { total } = getAppointmentFeeBreakdown(item);
    return total;
  };

  // Share payment link on WhatsApp
  const handleShareWhatsApp = (appt) => {
    if (!appt || !appt.payment_link) return;
    const patientName = appt.patient_name || 'Patient';
    const doctorName = appt.doctor_name || doctorsMap[appt.doctor_phone_id]?.name || 'Specialist Doctor';
    const apptDate = appt.date_of_appointment ? moment(appt.date_of_appointment).format('DD MMM YYYY') : '';
    const timeSlot = appt.time_slot || '';
    const { docFee, markup, total } = getAppointmentFeeBreakdown(appt);

    const msg =
      `🏥 *Care2Connect - Doctor Appointment Payment Link*\n\n` +
      `Hello *${patientName}*,\n` +
      `Your appointment has been initiated:\n\n` +
      `👨‍⚕️ *Doctor:* ${doctorName}\n` +
      (apptDate ? `📅 *Date:* ${apptDate}\n` : '') +
      (timeSlot ? `⏰ *Time Slot:* ${timeSlot}\n` : '') +
      `🩺 *Doctor Consultation Fee:* ₹${docFee.toFixed(2)}\n` +
      (markup > 0 ? `➕ *Channel Partner Markup:* ₹${markup.toFixed(2)}\n` : '') +
      `💰 *Total Payable Amount:* ₹${total.toFixed(2)}\n\n` +
      `👉 *Click here to Pay securely via UPI / QR / Card:* \n${appt.payment_link}\n\n` +
      `_Please complete payment to confirm your booking._`;

    const cleanMobile = String(appt.whatsapp_number || '').replace(/[^0-9]/g, '');
    const phoneParam = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const waUrl = phoneParam
      ? `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, '_blank');
  };

  // Initial load
  useEffect(() => {
    fetchDoctors();
    fetchAgentMarkup();
    fetchAppointments(fromDate, toDate, statusFilter);
  }, []);

  const handleApplyFilter = (e) => {
    e?.preventDefault();
    fetchAppointments(fromDate, toDate, statusFilter);
  };

  // Filtered appointments based on search query
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const nameMatch = (appt.patient_name || '').toLowerCase().includes(q);
      const apptNumMatch = (appt.appoint_number || appt.appointment_id || appt.reference_id || '').toLowerCase().includes(q);
      const rawToken = appt.appointment_index ?? appt.appoint_index ?? appt.token ?? appt.token_no ?? appt.token_number ?? appt.index_number;
      const tokenMatch = rawToken !== undefined && rawToken !== null && String(rawToken).trim() !== '' && String(rawToken).toLowerCase().includes(q);
      const phoneMatch = (appt.whatsapp_number || '').includes(q);
      const cityMatch = (appt.city || '').toLowerCase().includes(q);
      const doctorName = appt.doctor_name || doctorsMap[appt.doctor_phone_id]?.name || '';
      const doctorNameMatch = doctorName.toLowerCase().includes(q);
      const refMatch = (appt.reference_id || '').toLowerCase().includes(q);
      const plinkMatch = (appt.payment_link_id || '').toLowerCase().includes(q);

      return nameMatch || apptNumMatch || tokenMatch || phoneMatch || cityMatch || doctorNameMatch || refMatch || plinkMatch;
    });
  }, [appointments, searchQuery, doctorsMap]);

  // Helper to format date display
  const formatDateDisplay = (dateStr) => {
    if (!dateStr || dateStr === 'none') return 'N/A';
    const m = moment(dateStr);
    return m.isValid() ? m.format('DD MMM YYYY') : dateStr;
  };

  // Helper to resolve doctor name
  const getDoctorName = (docId, directDocName = '') => {
    if (directDocName && directDocName.trim()) {
      return directDocName;
    }
    if (!docId) return 'Specialist Doctor';
    const doc = doctorsMap[docId];
    if (doc && doc.name) {
      return `${doc.name} ${doc.speciality ? `(${doc.speciality})` : ''}`;
    }
    return `Doctor ID: ${docId.substring(0, 8)}...`;
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#1e293b',
      boxSizing: 'border-box',
      paddingBottom: '40px'
    }}>
      {/* =========================================================================
          TOP NAVBAR / HEADER
          ========================================================================= */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {/* Back Button & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#385FBF',
                fontSize: '18px',
                transition: 'all 0.2s ease'
              }}
              title="Back to Dashboard"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="fa-solid fa-clipboard-list" style={{ color: '#385FBF' }}></i>
                  Doctor Appointments
                </h1>
                <span style={{
                  backgroundColor: '#e0e7ff',
                  color: '#385FBF',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  {filteredAppointments.length}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Agent: <span style={{ fontWeight: '600', color: '#b4a383' }}>{agentId}</span>
              </p>
            </div>
          </div>

          {/* Right Action: Refresh button & Book New */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => fetchAppointments(fromDate, toDate, statusFilter, true)}
              disabled={refreshing || loading}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155'
              }}
            >
              <i className={`fa-solid fa-rotate-right ${refreshing ? 'fa-spin' : ''}`} style={{ color: '#385FBF' }}></i>
              <span style={{ display: 'inline' }}>Refresh</span>
            </button>

            <button
              onClick={() => navigate('/dr_appointment')}
              style={{
                backgroundColor: '#385FBF',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '0 2px 4px rgba(56, 95, 191, 0.25)'
              }}
            >
              <i className="fa-solid fa-calendar-plus" style={{ color: '#b4a383' }}></i>
              <span>Book Appointment</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 20px' }}>
        {/* =========================================================================
            FILTERS & SEARCH BAR
            ========================================================================= */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          {/* Payment Status Filter Tabs (All, Paid, Link Generated) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginRight: '6px' }}>
              <i className="fa-solid fa-filter" style={{ color: '#385FBF', marginRight: '6px' }}></i>
              Payment Status:
            </span>

            {[
              { id: '', label: 'All Statuses', icon: 'fa-list-check' },
              { id: 'paid', label: 'Paid', icon: 'fa-circle-check', color: '#16a34a' },
              { id: 'link generated', label: 'Link Generated', icon: 'fa-link', color: '#d97706' },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    fetchAppointments(fromDate, toDate, tab.id);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: `1.5px solid ${active ? (tab.color || '#385FBF') : '#e2e8f0'}`,
                    backgroundColor: active ? (tab.color ? `${tab.color}15` : '#eff6ff') : '#ffffff',
                    color: active ? (tab.color || '#385FBF') : '#64748b',
                    fontSize: '13px',
                    fontWeight: active ? '700' : '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className={`fa-solid ${tab.icon}`}></i>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Date Range Inputs & Search Form */}
          <form onSubmit={handleApplyFilter} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            alignItems: 'end'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                From Date (created_from)
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  color: '#1e293b'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                To Date (created_to)
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  color: '#1e293b'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  backgroundColor: '#385FBF',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setStatusFilter('');
                  setSearchQuery('');
                  fetchAppointments('', '', '');
                }}
                title="Clear all filters"
                style={{
                  padding: '9px 12px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fa-solid fa-rotate-left"></i>
              </button>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Search Patient / Token / Phone
              </label>
              <div style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-search"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    fontSize: '14px'
                  }}
                ></i>
                <input
                  type="text"
                  placeholder="Patient name, Token, Phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    color: '#1e293b'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* =========================================================================
            ERROR NOTIFICATION
            ========================================================================= */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '18px' }}></i>
              <span style={{ fontSize: '14px' }}>{error}</span>
            </div>
            <button
              onClick={() => fetchAppointments(fromDate, toDate)}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* =========================================================================
            LOADING SPINNER
            ========================================================================= */}
        {loading && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', color: '#385FBF', marginBottom: '12px' }}></i>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#334155' }}>Fetching Appointments...</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Communicating with Care2Connect backend server</div>
          </div>
        )}

        {/* =========================================================================
            EMPTY STATE
            ========================================================================= */}
        {!loading && filteredAppointments.length === 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#94a3b8',
              fontSize: '28px'
            }}>
              <i className="fa-solid fa-clipboard-question"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 6px 0' }}>
              No Appointments Found
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '420px', margin: '0 auto 20px' }}>
              {searchQuery
                ? `No matching appointments found for "${searchQuery}". Try adjusting your search keyword or clearing date filters.`
                : `No doctor appointments found for Agent ${agentId} in the selected date range (${fromDate || 'Start'} to ${toDate || 'End'}).`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  fetchAppointments('', '');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Clear Date Filter
              </button>
              <button
                onClick={() => navigate('/dr_appointment')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#385FBF',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-plus"></i> Book First Appointment
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            APPOINTMENTS CARD GRID
            ========================================================================= */}
        {!loading && filteredAppointments.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px'
          }}>
            {filteredAppointments.map((appt) => {
              const isPaid = (appt.payment_status || '').toLowerCase() === 'paid' || (appt.status || '').toLowerCase() === 'success';
              const isLinkGenerated = (appt.payment_status || '').toLowerCase() === 'link generated';
              const paymentUrl = appt.payment_link || appt.payment_url || '';
              const doctorTitle = getDoctorName(appt.doctor_phone_id, appt.doctor_name);
              const rawToken = appt.appointment_index ?? appt.appoint_index ?? appt.token ?? appt.token_no ?? appt.token_number ?? appt.index_number;
              const hasToken = rawToken !== undefined && rawToken !== null && String(rawToken).trim() !== '' && String(rawToken).trim() !== '0';
              const displayApptId = appt.appoint_number || appt.reference_id || appt.appointment_id || 'N/A';

              return (
                <div
                  key={appt._id || appt.appoint_number || Math.random()}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  {/* Card Header */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {hasToken ? (
                          <span style={{
                            backgroundColor: '#385FBF',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: '700',
                            padding: '3px 9px',
                            borderRadius: '6px'
                          }}>
                            Token #{rawToken}
                          </span>
                        ) : (
                          <span style={{
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            Token: N/A
                          </span>
                        )}

                        <span style={{
                          backgroundColor: isPaid ? '#ecfdf5' : (isLinkGenerated ? '#fff7ed' : '#fffbeb'),
                          color: isPaid ? '#059669' : (isLinkGenerated ? '#c2410c' : '#d97706'),
                          border: `1px solid ${isPaid ? '#a7f3d0' : (isLinkGenerated ? '#fed7aa' : '#fde68a')}`,
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <i className={`fa-solid ${isPaid ? 'fa-circle-check' : (isLinkGenerated ? 'fa-link' : 'fa-clock')}`}></i>
                          {isPaid ? 'PAID' : (isLinkGenerated ? 'LINK GENERATED' : (appt.payment_status || 'PENDING'))}
                        </span>
                      </div>

                      {/* Total Payable Fee Badge */}
                      <div style={{
                        textAlign: 'right',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                      }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                        }}>
                          Total Payable
                        </span>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '800',
                          color: '#15803d',
                          backgroundColor: '#f0fdf4',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid #bbf7d0',
                          marginTop: '2px',
                        }}>
                          ₹{getAppointmentAmount(appt).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Patient Name */}
                    <div style={{ marginBottom: '6px' }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '17px',
                        fontWeight: '700',
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{appt.patient_name || 'Anonymous Patient'}</span>
                        {appt.sex && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#64748b',
                            backgroundColor: '#f1f5f9',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            {appt.sex} {appt.age && `(${appt.age}y)`}
                          </span>
                        )}
                      </h3>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        ID: <strong style={{ color: '#334155' }}>{displayApptId}</strong>
                      </div>
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '10px 0' }}></div>

                    {/* Meta Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569' }}>
                      {/* Doctor info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-user-doctor" style={{ color: '#385FBF', width: '16px', textAlign: 'center' }}></i>
                        <span style={{ fontWeight: '600', color: '#1e293b' }}>{doctorTitle}</span>
                      </div>

                      {/* Appointment Date & Slot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-calendar-day" style={{ color: '#b4a383', width: '16px', textAlign: 'center' }}></i>
                        <span>
                          <strong>{formatDateDisplay(appt.date_of_appointment)}</strong> • {appt.time_slot || 'All Day'}
                        </span>
                      </div>

                      {/* Location / City */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-location-dot" style={{ color: '#ef4444', width: '16px', textAlign: 'center' }}></i>
                        <span>{appt.city ? `${appt.city}${appt.state ? `, ${appt.state}` : ''}` : 'Location N/A'}</span>
                      </div>

                      {/* Contact / Phone */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-brands fa-whatsapp" style={{ color: '#22c55e', width: '16px', textAlign: 'center' }}></i>
                        <span>+{appt.whatsapp_number || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Quick Payment Link Action Strip (when payment_link exists and not yet paid) */}
                    {paymentUrl && !isPaid && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px',
                        backgroundColor: '#fffbeb',
                        border: '1px dashed #fcd34d',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#92400e',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <i className="fa-solid fa-qrcode" style={{ color: '#d97706' }}></i>
                            UPI Payment Link
                          </span>
                          {appt.reference_id && (
                            <span style={{
                              fontSize: '10px',
                              color: '#78350f',
                              backgroundColor: '#fef3c7',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontFamily: 'monospace'
                            }}>
                              {appt.reference_id}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareWhatsApp(appt);
                            }}
                            style={{
                              padding: '7px 8px',
                              backgroundColor: '#25D366',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                            title="Share payment link via WhatsApp"
                          >
                            <i className="fa-brands fa-whatsapp"></i> WhatsApp
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPaymentLink(paymentUrl, appt._id);
                            }}
                            style={{
                              padding: '7px 8px',
                              backgroundColor: copiedId === appt._id ? '#059669' : '#ffffff',
                              color: copiedId === appt._id ? '#ffffff' : '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                            title="Copy link to clipboard"
                          >
                            <i className={`fa-solid ${copiedId === appt._id ? 'fa-check' : 'fa-copy'}`}></i>
                            {copiedId === appt._id ? 'Copied' : 'Copy'}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(paymentUrl, '_blank');
                            }}
                            style={{
                              padding: '7px 10px',
                              backgroundColor: '#385FBF',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                            title="Open payment page to pay"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square"></i> Pay
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Confirmed Paid Strip */}
                    {isPaid && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#065f46', fontWeight: '600' }}>
                          <i className="fa-solid fa-circle-check" style={{ color: '#059669' }}></i>
                          Payment Received
                        </div>
                        <span style={{ fontSize: '11px', color: '#047857' }}>
                          {appt.paid_at ? moment(appt.paid_at).format('DD MMM, hh:mm A') : 'Confirmed'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setSelectedAppointment(appt)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#385FBF',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    >
                      <i className="fa-solid fa-circle-info"></i>
                      View Full Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          APPOINTMENT DETAILS MODAL
          ========================================================================= */}
      {selectedAppointment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#385FBF',
              color: '#ffffff',
              borderRadius: '15px 15px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#b4a383',
                  fontSize: '18px'
                }}>
                  <i className="fa-solid fa-file-medical"></i>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                    Appointment Details
                  </h2>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>
                    Appt No: <strong style={{ color: '#fef08a' }}>{selectedAppointment.appoint_number || selectedAppointment.reference_id || selectedAppointment.appointment_id || 'N/A'}</strong>
                    {selectedAppointment._id && (
                      <span style={{ opacity: 0.8, marginLeft: '8px' }}>
                        (ID: {String(selectedAppointment._id).slice(-8)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedAppointment(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.1)'
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Status Header Banner */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Token / Index</div>
                  <div style={{
                    fontSize: (selectedAppointment.appointment_index ?? selectedAppointment.appoint_index ?? selectedAppointment.token ?? selectedAppointment.token_no ?? selectedAppointment.token_number ?? selectedAppointment.index_number) !== undefined ? '20px' : '16px',
                    fontWeight: '800',
                    color: (selectedAppointment.appointment_index ?? selectedAppointment.appoint_index ?? selectedAppointment.token ?? selectedAppointment.token_no ?? selectedAppointment.token_number ?? selectedAppointment.index_number) !== undefined ? '#385FBF' : '#64748b'
                  }}>
                    {(selectedAppointment.appointment_index ?? selectedAppointment.appoint_index ?? selectedAppointment.token ?? selectedAppointment.token_no ?? selectedAppointment.token_number ?? selectedAppointment.index_number) !== undefined
                      ? `Token #${selectedAppointment.appointment_index ?? selectedAppointment.appoint_index ?? selectedAppointment.token ?? selectedAppointment.token_no ?? selectedAppointment.token_number ?? selectedAppointment.index_number}`
                      : 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Payment Status</div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: (selectedAppointment.payment_status === 'paid' || selectedAppointment.status === 'success')
                      ? '#059669'
                      : (selectedAppointment.payment_status === 'link generated' ? '#c2410c' : '#d97706'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className={`fa-solid ${(selectedAppointment.payment_status === 'paid' || selectedAppointment.status === 'success')
                      ? 'fa-circle-check'
                      : (selectedAppointment.payment_status === 'link generated' ? 'fa-link' : 'fa-clock')}`}></i>
                    {(selectedAppointment.payment_status || selectedAppointment.status || 'Pending').toUpperCase()}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    Total Payable
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>
                    ₹{getAppointmentAmount(selectedAppointment).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Dedicated UPI / Online Payment Box (only if real http payment URL exists and not paid) */}
              {(() => {
                const pUrl = selectedAppointment.payment_link ||
                  (selectedAppointment.payment_url && String(selectedAppointment.payment_url).startsWith('http') ? selectedAppointment.payment_url : '') ||
                  (selectedAppointment.razorpay_url && String(selectedAppointment.razorpay_url).startsWith('http') ? selectedAppointment.razorpay_url : '');
                if (!pUrl) return null;
                return (
                  <div style={{
                    backgroundColor: '#fffbeb',
                    border: '1.5px solid #fde68a',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.08)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          backgroundColor: '#fef3c7',
                          color: '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '17px'
                        }}>
                          <i className="fa-solid fa-qrcode"></i>
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#92400e' }}>
                            UPI & Online Payment Gateway
                          </h4>
                          <div style={{ fontSize: '12px', color: '#b45309' }}>
                            Pay via UPI QR (GPay, PhonePe, Paytm) or Card / Netbanking
                          </div>
                        </div>
                      </div>

                      <span style={{
                        backgroundColor: (selectedAppointment.payment_status === 'paid' || selectedAppointment.status === 'success') ? '#ecfdf5' : '#fed7aa',
                        color: (selectedAppointment.payment_status === 'paid' || selectedAppointment.status === 'success') ? '#059669' : '#c2410c',
                        border: `1px solid ${(selectedAppointment.payment_status === 'paid' || selectedAppointment.status === 'success') ? '#a7f3d0' : '#fdba74'}`,
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <i className={`fa-solid ${(selectedAppointment.payment_status === 'paid' || selectedAppointment.status === 'success') ? 'fa-circle-check' : 'fa-link'}`}></i>
                        {(selectedAppointment.payment_status || 'LINK GENERATED').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* QR Code */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid #fef3c7',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pUrl)}`}
                          alt="Payment QR Code"
                          style={{ width: '130px', height: '130px', borderRadius: '4px', display: 'block' }}
                        />
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#78350f', marginTop: '6px' }}>
                          Scan with any UPI App
                        </span>
                      </div>

                      {/* Payment Link & Actions */}
                      <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Payment Link
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              readOnly
                              value={pUrl}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                fontSize: '12px',
                                border: '1px solid #fcd34d',
                                borderRadius: '6px',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontFamily: 'monospace'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyPaymentLink(pUrl, selectedAppointment._id)}
                              style={{
                                padding: '8px 14px',
                                backgroundColor: copiedId === selectedAppointment._id ? '#059669' : '#385FBF',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <i className={`fa-solid ${copiedId === selectedAppointment._id ? 'fa-check' : 'fa-copy'}`}></i>
                              {copiedId === selectedAppointment._id ? 'Copied!' : 'Copy Link'}
                            </button>
                          </div>
                        </div>

                        {/* WhatsApp Share & Open Page */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(selectedAppointment)}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              backgroundColor: '#25D366',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 4px rgba(37, 211, 102, 0.25)'
                            }}
                          >
                            <i className="fa-brands fa-whatsapp" style={{ fontSize: '16px' }}></i>
                            Share on WhatsApp
                          </button>

                          <button
                            type="button"
                            onClick={() => window.open(pUrl, '_blank')}
                            style={{
                              padding: '10px 16px',
                              backgroundColor: '#ffffff',
                              color: '#1e293b',
                              border: '1.5px solid #cbd5e1',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: '#385FBF' }}></i>
                            Open Payment Page
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Grid of Sections */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {/* Section 1: Patient Information */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#385FBF',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-user"></i> Patient Information
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Full Name: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.patient_name || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Guardian / Father: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.guardian_name || selectedAppointment.father_name || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Age / DOB: </span>
                      <strong style={{ color: '#1e293b' }}>
                        {selectedAppointment.age !== undefined && selectedAppointment.age !== null && String(selectedAppointment.age).trim() !== ''
                          ? `${selectedAppointment.age} years`
                          : 'N/A'}
                        {selectedAppointment.date_of_birth && selectedAppointment.date_of_birth !== 'none' && ` (DOB: ${selectedAppointment.date_of_birth})`}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Gender: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.sex || selectedAppointment.gender || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Symptoms: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.symptoms || 'Routine Consultation'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Vaccine Opted: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.vaccine || 'No'}</strong>
                    </div>
                    {selectedAppointment.role && (
                      <div>
                        <span style={{ color: '#64748b' }}>Role: </span>
                        <span style={{ textTransform: 'capitalize', color: '#1e293b', fontWeight: '600' }}>{selectedAppointment.role}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Appointment & Doctor Details */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#385FBF',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-user-doctor"></i> Doctor & Schedule
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Doctor: </span>
                      <strong style={{ color: '#1e293b' }}>{getDoctorName(selectedAppointment.doctor_phone_id, selectedAppointment.doctor_name)}</strong>
                    </div>
                    {selectedAppointment.doctor_phone_id && (
                      <div>
                        <span style={{ color: '#64748b' }}>Doctor ID: </span>
                        <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#1e293b' }}>
                          {selectedAppointment.doctor_phone_id}
                        </code>
                      </div>
                    )}
                    <div>
                      <span style={{ color: '#64748b' }}>Appointment No: </span>
                      <strong style={{ color: '#385FBF' }}>{selectedAppointment.appoint_number || 'N/A'}</strong>
                    </div>
                    {selectedAppointment.appointment_index !== undefined && selectedAppointment.appointment_index !== null && (
                      <div>
                        <span style={{ color: '#64748b' }}>Token / Index: </span>
                        <strong style={{ color: '#385FBF' }}>#{selectedAppointment.appointment_index}</strong>
                      </div>
                    )}
                    <div>
                      <span style={{ color: '#64748b' }}>Appointment Date: </span>
                      <strong style={{ color: '#1e293b' }}>{formatDateDisplay(selectedAppointment.date_of_appointment)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Time Slot: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.time_slot || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Appointment Type: </span>
                      <strong style={{ color: '#1e293b', textTransform: 'capitalize' }}>
                        {selectedAppointment.appointmenttype || selectedAppointment.appointment_type || 'Regular'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Booking Agent ID: </span>
                      <strong style={{ color: '#b4a383' }}>
                        {selectedAppointment.agent_code || (!/^[a-f\d]{24}$/i.test(selectedAppointment.agent_id || '') ? selectedAppointment.agent_id : agentId)}
                      </strong>
                    </div>
                    {selectedAppointment.itype && (
                      <div>
                        <span style={{ color: '#64748b' }}>Type / Mode: </span>
                        <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                          {selectedAppointment.itype}
                        </span>
                      </div>
                    )}
                    {selectedAppointment.kalra_id && selectedAppointment.kalra_id !== 'xx' && (
                      <div>
                        <span style={{ color: '#64748b' }}>Kalra ID: </span>
                        <strong style={{ color: '#1e293b' }}>{selectedAppointment.kalra_id}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Contact & Address */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#385FBF',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-address-book"></i> Contact & Address
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>WhatsApp / Mobile: </span>
                      <strong style={{ color: '#1e293b' }}>
                        {selectedAppointment.whatsapp_number
                          ? (String(selectedAppointment.whatsapp_number).startsWith('+') ? selectedAppointment.whatsapp_number : `+${selectedAppointment.whatsapp_number}`)
                          : (selectedAppointment.mobile || selectedAppointment.patient_phone || 'N/A')}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Email: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.email || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Address: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.address || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>City: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.city || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>State: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.state || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Pincode: </span>
                      <strong style={{ color: '#1e293b' }}>{selectedAppointment.pincode || 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                {/* Section 4: Payment & Transaction */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#385FBF',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-receipt"></i> Transaction Details
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    {(() => {
                      const breakdown = getAppointmentFeeBreakdown(selectedAppointment);
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Doctor Consultation Fee:</span>
                            <strong style={{ color: '#1e293b' }}>₹{breakdown.docFee.toFixed(2)}</strong>
                          </div>
                          {breakdown.markup > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}>
                              <span>Channel Partner Markup:</span>
                              <strong>+ ₹{breakdown.markup.toFixed(2)}</strong>
                            </div>
                          )}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingTop: '6px',
                            borderTop: '1px solid #e2e8f0',
                            fontSize: '14px'
                          }}>
                            <span style={{ fontWeight: '700', color: '#1e293b' }}>Total Payable Amount:</span>
                            <strong style={{ color: '#15803d', fontWeight: '800' }}>₹{breakdown.total.toFixed(2)}</strong>
                          </div>
                        </>
                      );
                    })()}

                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '2px 0' }}></div>

                    <div>
                      <span style={{ color: '#64748b' }}>Payment Status: </span>
                      <strong style={{
                        color: (selectedAppointment.payment_status === 'paid' || selectedAppointment.status === 'success') ? '#059669' : '#d97706',
                        textTransform: 'uppercase'
                      }}>
                        {selectedAppointment.payment_status || selectedAppointment.status || 'Pending'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Payment Mode: </span>
                      <strong style={{ color: '#1e293b' }}>
                        {selectedAppointment.wallet_number || (selectedAppointment.pay_id && String(selectedAppointment.pay_id).startsWith('wlt_'))
                          ? `Agent Wallet (${(selectedAppointment.wallet_type || 'saving').toUpperCase()})`
                          : (selectedAppointment.payment_link ? 'UPI / Online Gateway' : 'Standard')}
                      </strong>
                    </div>

                    {/* Agent Wallet & Voucher Block if present */}
                    {(selectedAppointment.transaction_number || selectedAppointment.voucher_number || selectedAppointment.wallet_number) && (
                      <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '2px'
                      }}>
                        {selectedAppointment.transaction_number && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>Txn No:</span>
                            <code style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                              {selectedAppointment.transaction_number}
                            </code>
                          </div>
                        )}
                        {selectedAppointment.voucher_number && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>Voucher:</span>
                            <code style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}>
                              {selectedAppointment.voucher_number}
                            </code>
                          </div>
                        )}
                        {selectedAppointment.wallet_number && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>Wallet:</span>
                            <code style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}>
                              {selectedAppointment.wallet_number}
                            </code>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedAppointment.pay_id && (
                      <div>
                        <span style={{ color: '#64748b' }}>Payment ID (pay_id): </span>
                        <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}>
                          {selectedAppointment.pay_id}
                        </code>
                      </div>
                    )}

                    {selectedAppointment.reference_id && (
                      <div>
                        <span style={{ color: '#64748b' }}>Reference ID: </span>
                        <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}>
                          {selectedAppointment.reference_id}
                        </code>
                      </div>
                    )}

                    {selectedAppointment.timestamp && (
                      <div>
                        <span style={{ color: '#64748b' }}>Timestamp: </span>
                        <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}>
                          {selectedAppointment.timestamp}
                        </code>
                        {(!isNaN(Number(selectedAppointment.timestamp)) && Number(selectedAppointment.timestamp) > 1000000000) && (
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                            ({moment.unix(Number(selectedAppointment.timestamp) > 10000000000 ? Math.floor(Number(selectedAppointment.timestamp) / 1000) : Number(selectedAppointment.timestamp)).format('DD MMM YYYY, hh:mm A')})
                          </span>
                        )}
                      </div>
                    )}

                    <div>
                      <span style={{ color: '#64748b' }}>Paid At: </span>
                      <span style={{ color: '#334155' }}>
                        {selectedAppointment.paid_at ? moment(selectedAppointment.paid_at).format('DD MMM YYYY, hh:mm A') : 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Created At: </span>
                      <span style={{ color: '#334155' }}>
                        {selectedAppointment.createdAt ? moment(selectedAppointment.createdAt).format('DD MMM YYYY, hh:mm A') : 'N/A'}
                      </span>
                    </div>

                    {selectedAppointment._id && (
                      <div>
                        <span style={{ color: '#64748b' }}>Record ID: </span>
                        <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#64748b' }}>
                          {selectedAppointment._id}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons inside Modal */}
              <div style={{
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                {(selectedAppointment.payment_link || selectedAppointment.payment_url) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(selectedAppointment)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#25D366',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-brands fa-whatsapp"></i> Share on WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(selectedAppointment.payment_link || selectedAppointment.payment_url, '_blank')}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#eff6ff',
                        color: '#385FBF',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i> Pay Online
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAppointment(null)}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#385FBF',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointlmentList;
