import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import { BASE_URL } from '../config/api';

const ChannelPartner = () => {
  const navigate = useNavigate();

  // User details from localStorage
  const agentCode = localStorage.getItem('agentCode') || localStorage.getItem('AUID') || '';
  const agentName = localStorage.getItem('Name') || '';
  const memberId = localStorage.getItem('MID') || '';
  const branchCode = localStorage.getItem('branchCode') || '';
  const branchName = localStorage.getItem('branchName') || '';

  const [agentId, setAgentId] = useState(localStorage.getItem('agent_id') || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [showForm, setShowForm] = useState(false);

  // 1. Resolve MongoDB agent_id if not already in localStorage
  const resolveAgentId = useCallback(async () => {
    let id = localStorage.getItem('agent_id') || '';
    if (id && /^[a-f\d]{24}$/i.test(id)) {
      setAgentId(id);
      return id;
    }

    try {
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      const res = await axios.get(`${BASE_URL}/wallet/list`, { timeout: 20000, headers });
      const wallets = res.data?.data || [];
      const match = wallets.find(
        (w) =>
          (w.agentCode || '').toLowerCase() === agentCode.toLowerCase() ||
          (w.agent_id || '').toLowerCase() === agentCode.toLowerCase()
      );

      if (match?.agent_id) {
        localStorage.setItem('agent_id', match.agent_id);
        setAgentId(match.agent_id);
        return match.agent_id;
      }
    } catch (err) {
      console.warn('Could not resolve agent_id:', err.message);
    }
    return '';
  }, [agentCode]);

  // 2. Fetch existing channel partner requests for this agent
  const fetchRequests = useCallback(async (currentAgentId) => {
    const targetId = currentAgentId || agentId;
    if (!targetId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      const res = await axios.get(`${BASE_URL}/channel-partner-requests?agent_id=${targetId}`, {
        timeout: 20000,
        headers,
      });

      if (res.data && res.data.success) {
        const list = res.data.data || [];
        setRequests(list);
        if (list.length > 0) {
          localStorage.setItem('channelPartnerApplied', 'true');
          const isAppr = list.some((r) => r.status === 'approved');
          localStorage.setItem('channelPartnerStatus', isAppr ? 'approved' : (list[0].status || 'pending'));
        }
      }
    } catch (error) {
      console.error('Error fetching channel partner requests:', error);
      toast.error(error.response?.data?.message || 'Failed to load channel partner status');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    const init = async () => {
      const resolvedId = await resolveAgentId();
      if (resolvedId) {
        await fetchRequests(resolvedId);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [resolveAgentId, fetchRequests]);

  // 3. Submit Channel Partner Application
  const handleApply = async (e) => {
    e.preventDefault();

    let targetAgentId = agentId;
    if (!targetAgentId) {
      targetAgentId = await resolveAgentId();
    }

    if (!targetAgentId) {
      toast.error('Agent identification failed. Please re-login.');
      return;
    }

    setSubmitting(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      };

      const payload = {
        agent_id: targetAgentId,
        agent_name: agentName || agentCode,
        remarks: remarks.trim(),
      };

      const res = await axios.post(`${BASE_URL}/channel-partner-requests`, payload, {
        headers,
      });

      if (res.data && res.data.success) {
        localStorage.setItem('channelPartnerApplied', 'true');
        localStorage.setItem('channelPartnerStatus', 'pending');
        toast.success(res.data.message || 'Channel partner request submitted successfully!');
        setRemarks('');
        setShowForm(false);
        await fetchRequests(targetAgentId);
      } else {
        toast.error(res.data?.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error applying for channel partner:', error);
      const msg = error.response?.data?.message || 'Submission failed. Please try again.';
      toast.error(msg);
      if (error.response?.status === 409 || error.response?.status === 400) {
        await fetchRequests(targetAgentId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Determine current active status
  const latestRequest = requests.length > 0 ? requests[0] : null;
  const isApproved = requests.some((r) => r.status === 'approved');
  const approvedRecord = requests.find((r) => r.status === 'approved');
  const isPending = !isApproved && latestRequest?.status === 'pending';
  const isRejected = !isApproved && latestRequest?.status === 'rejected';

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#fcfaf5', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', paddingBottom: '40px' }}>
      
      {/* Header */}
      <h2 style={{
        textAlign: 'center',
        color: '#b4a383',
        fontSize: '18px',
        padding: '16px 20px',
        margin: '0',
        position: 'relative',
        backgroundColor: 'white',
        borderBottom: '1px solid #eee'
      }}>
        <i
          className="fa-solid fa-arrow-left"
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            fontSize: '20px',
            color: '#b4a383',
            marginLeft: '20px',
          }}
          onClick={() => navigate('/')}
        />
        Channel Partner Application
        <i
          className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            fontSize: '18px',
            color: '#b4a383',
            marginRight: '20px',
          }}
          title="Refresh Status"
          onClick={() => fetchRequests(agentId)}
        />
      </h2>

      <div style={{ maxWidth: '650px', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Agent Profile Summary Card */}
        <div style={{
          margin: '16px 16px 0',
          padding: '18px 20px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #385FBF 100%)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255,255,255,0.18)',
              fontSize: '11px',
              fontWeight: '600',
              marginBottom: '6px'
            }}>
              <i className="fa-solid fa-shield-halved" style={{ fontSize: '11px' }}></i>
              Agent Profile
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 'bold' }}>
              {agentName || 'Agent'}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', opacity: 0.9 }}>
              <span>Code: <strong style={{ color: '#fff', letterSpacing: '0.5px' }}>{agentCode || 'N/A'}</strong></span>
              {memberId && <span>Member ID: <strong>{memberId}</strong></span>}
              {branchCode && <span>Branch: <strong>{branchCode} {branchName ? `(${branchName})` : ''}</strong></span>}
            </div>
          </div>

          {/* Current Status Pill */}
          <div>
            {isApproved && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(16, 185, 129, 0.25)',
                color: '#6EE7B7',
                border: '1px solid rgba(110, 231, 183, 0.4)'
              }}>
                <i className="fa-solid fa-circle-check"></i> Approved Partner
              </span>
            )}
            {isPending && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(245, 158, 11, 0.25)',
                color: '#FDE68A',
                border: '1px solid rgba(253, 230, 138, 0.4)'
              }}>
                <i className="fa-solid fa-clock"></i> Pending Review
              </span>
            )}
            {isRejected && !showForm && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                color: '#FCA5A5',
                border: '1px solid rgba(252, 165, 165, 0.4)'
              }}>
                <i className="fa-solid fa-circle-xmark"></i> Rejected
              </span>
            )}
            {!latestRequest && !loading && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <i className="fa-solid fa-circle-info"></i> Not Applied
              </span>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div style={{
            margin: '20px 16px',
            padding: '30px',
            backgroundColor: 'white',
            borderRadius: '12px',
            textAlign: 'center',
            border: '1px solid #E5E7EB',
            color: '#6B7280'
          }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '26px', color: '#385FBF', marginBottom: '10px' }}></i>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Checking channel partner status...</div>
          </div>
        )}

        {/* 1. APPROVED STATE CARD */}
        {!loading && isApproved && (
          <div style={{
            margin: '16px 16px 0',
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: 'white',
            border: '1px solid #A7F3D0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: '#D1FAE5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-award"></i>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 'bold', color: '#1F2937' }}>
                  You are an Approved Channel Partner!
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                  Your channel partner privileges and markup are active.
                </p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              backgroundColor: '#F9FAFB',
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid #F3F4F6'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', display: 'block' }}>
                  STATUS
                </span>
                <span style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: '#D1FAE5',
                  color: '#065F46'
                }}>
                  ACTIVE
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', display: 'block' }}>
                  MARKUP AMOUNT
                </span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginTop: '2px', display: 'block' }}>
                  {approvedRecord?.markup_amount !== null && approvedRecord?.markup_amount !== undefined
                    ? `₹${approvedRecord.markup_amount}`
                    : 'Standard'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', display: 'block' }}>
                  APPROVED ON
                </span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginTop: '4px', display: 'block' }}>
                  {approvedRecord?.approvedAt ? moment(approvedRecord.approvedAt).format('DD MMM YYYY') : 'Recently'}
                </span>
              </div>
            </div>

            <div style={{
              marginTop: '14px',
              padding: '12px 14px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #D1FAE5',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '12px',
              color: '#065F46',
              lineHeight: '1.5'
            }}>
              <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '14px', marginTop: '2px' }}></i>
              <div>
                <strong>Channel Partner Privileges Active:</strong> You receive automatic partner markup allocation and access to channel partner commissions and booking perks.
              </div>
            </div>
          </div>
        )}

        {/* 2. PENDING REVIEW STATE CARD */}
        {!loading && isPending && (
          <div style={{
            margin: '16px 16px 0',
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: 'white',
            border: '1px solid #FDE68A',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-hourglass-half"></i>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 'bold', color: '#1F2937' }}>
                  Application Under Review
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                  Submitted on {moment(latestRequest?.created_at).format('DD MMM YYYY, hh:mm A')}
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#FFFBEB',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid #FEF3C7',
              fontSize: '12px',
              color: '#92400E',
              lineHeight: '1.6'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '4px' }}>
                <i className="fa-solid fa-circle-info" style={{ color: '#D97706' }}></i>
                Request Status: Pending Administration Approval
              </div>
              <p style={{ margin: 0 }}>
                Your channel partner application is being verified by the management. Once approved, your allocated markup amount and partner status will be activated automatically.
              </p>
              {latestRequest?.remarks && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #FDE68A', color: '#4B5563' }}>
                  <span style={{ fontWeight: 'bold' }}>Your Remarks: </span>
                  "{latestRequest.remarks}"
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => fetchRequests(agentId)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#92400E',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-rotate-right" style={{ fontSize: '11px' }}></i>
                Check for Updates
              </button>
            </div>
          </div>
        )}

        {/* 3. REJECTED STATE CARD */}
        {!loading && isRejected && !showForm && (
          <div style={{
            margin: '16px 16px 0',
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: 'white',
            border: '1px solid #FECDD3',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-circle-xmark"></i>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 'bold', color: '#1F2937' }}>
                  Application Not Approved
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                  Reviewed on {latestRequest?.rejectedAt ? moment(latestRequest.rejectedAt).format('DD MMM YYYY') : 'Recently'}
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#FFF1F2',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid #FECDD3',
              fontSize: '12px',
              color: '#9F1239'
            }}>
              <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Reason for Rejection:</span>
              <p style={{ margin: 0, color: '#4B5563', fontStyle: 'italic' }}>
                "{latestRequest?.rejectedReason || 'No specific reason provided by administration.'}"
              </p>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: '#385FBF',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-redo" style={{ fontSize: '11px' }}></i>
                Re-apply for Channel Partner
              </button>
            </div>
          </div>
        )}

        {/* 4. FRESH APPLICATION FORM */}
        {!loading && (!latestRequest || (!isApproved && !isPending && showForm)) && (
          <div style={{
            margin: '16px 16px 0',
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            boxSizing: 'border-box'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '14px',
              borderBottom: '1px solid #F3F4F6',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px'
                }}>
                  <i className="fa-solid fa-file-signature"></i>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 'bold', color: '#1F2937' }}>
                    Apply for Channel Partner
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                    Fill the application details to submit your request
                  </p>
                </div>
              </div>
              {showForm && isRejected && (
                <button
                  onClick={() => setShowForm(false)}
                  style={{ background: 'none', border: 'none', fontSize: '12px', color: '#6B7280', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Benefits Banner */}
            <div style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '18px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#1E40AF',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <i className="fa-solid fa-star" style={{ color: '#F59E0B' }}></i>
                Channel Partner Benefits
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#374151', lineHeight: '1.6' }}>
                <li>Allocated partner markup revenue sharing</li>
                <li>Direct association with enterprise doctor & member networks</li>
                <li>Priority booking and exclusive commission slabs</li>
              </ul>
            </div>

            {/* Form */}
            <form onSubmit={handleApply}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4B5563', marginBottom: '5px' }}>
                    Agent Code
                  </label>
                  <input
                    type="text"
                    value={agentCode}
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#F3F4F6',
                      color: '#4B5563',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4B5563', marginBottom: '5px' }}>
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentName || 'N/A'}
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#F3F4F6',
                      color: '#4B5563',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4B5563', marginBottom: '5px' }}>
                  Branch Information
                </label>
                <input
                  type="text"
                  value={`${branchCode ? `Branch ${branchCode}` : 'Default Branch'} ${branchName ? `- ${branchName}` : ''}`}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#F3F4F6',
                    color: '#4B5563',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label htmlFor="remarks" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '5px' }}>
                  Remarks / Proposal <span style={{ color: '#9CA3AF', fontWeight: 'normal' }}>(Optional)</span>
                </label>
                <textarea
                  id="remarks"
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter any notes or reasons for admin consideration (e.g., business background, location, client base)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '13px',
                    color: '#1F2937',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#385FBF',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(56, 95, 191, 0.3)'
                }}
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane" style={{ fontSize: '12px' }}></i>
                    <span>Submit Channel Partner Request</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* 5. APPLICATION HISTORY LIST */}
        {requests.length > 0 && (
          <div style={{
            margin: '16px 16px 0',
            padding: '18px 20px',
            borderRadius: '12px',
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            boxSizing: 'border-box'
          }}>
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#1F2937',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-list-check" style={{ color: '#385FBF' }}></i>
              Application History ({requests.length})
            </h3>

            <div>
              {requests.map((req, idx) => {
                const isItemApproved = req.status === 'approved';
                const isItemRejected = req.status === 'rejected';

                const statusColor = isItemApproved ? '#059669' : isItemRejected ? '#DC2626' : '#D97706';
                const statusBg = isItemApproved ? '#D1FAE5' : isItemRejected ? '#FEE2E2' : '#FEF3C7';

                return (
                  <div
                    key={req._id || idx}
                    style={{
                      padding: '12px 0',
                      borderBottom: idx === requests.length - 1 ? 'none' : '1px solid #F3F4F6',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            color: statusColor,
                            backgroundColor: statusBg,
                          }}
                        >
                          {req.status}
                        </span>
                        {req.markup_amount !== null && req.markup_amount !== undefined && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#059669',
                            backgroundColor: '#ECFDF5',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid #A7F3D0'
                          }}>
                            Markup: ₹{req.markup_amount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        Applied: {moment(req.created_at).format('DD MMM YYYY, hh:mm A')}
                      </div>
                      {req.remarks && (
                        <div style={{ fontSize: '12px', color: '#374151', fontStyle: 'italic', marginTop: '3px' }}>
                          "{req.remarks}"
                        </div>
                      )}
                      {req.rejectedReason && (
                        <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '3px' }}>
                          Reason: {req.rejectedReason}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '11px', color: '#9CA3AF' }}>
                      {req.approvedBy && (
                        <div>Approved by: <strong style={{ color: '#4B5563' }}>{req.approvedBy}</strong></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelPartner;
