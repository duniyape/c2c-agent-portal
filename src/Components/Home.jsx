import React, { useEffect, useState } from 'react';
import { IoLogOutOutline, IoListCircleOutline, IoCloseOutline } from 'react-icons/io5';
import FirstRoute from './FirstRoute';
import SecondRoute from './SecondRoute';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';
import { BASE_URL } from '../config/api';

const Home = () => {
  const [index, setIndex] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [agentProfile, setAgentProfile] = useState({
    name: localStorage.getItem('Name') || '',
    agentCode: localStorage.getItem('agentCode') || localStorage.getItem('AUID') || '',
    memberId: localStorage.getItem('MID') || '',
    branchName: localStorage.getItem('branchName') || '',
    branchCode: localStorage.getItem('branchCode') || '',
    designationName: localStorage.getItem('designationName') || '',
    agentStatus: localStorage.getItem('agentStatus') || 'Active',
    mobileNo: localStorage.getItem('MobileNo') || '',
    email: localStorage.getItem('Email') || '',
  });

  const navigate = useNavigate();

  const handleLogout = async () => {
    const { isConfirmed } = await Swal.fire({
      title: "Do you want to logout?",
      text: "You'll be logged out of this session.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Logout",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (isConfirmed) {
      try {
        localStorage.removeItem('AUID');
        localStorage.removeItem('agentCode');
        localStorage.removeItem('Name');
        localStorage.removeItem('MID');
        localStorage.removeItem('user');
        localStorage.removeItem('agentProfile');
        localStorage.removeItem('branchCode');
        localStorage.removeItem('branchName');
        localStorage.removeItem('designationCode');
        localStorage.removeItem('designationName');
        localStorage.removeItem('agentStatus');
        localStorage.removeItem('MobileNo');
        localStorage.removeItem('Email');
        navigate('/login');
      } catch (err) {
        Swal.fire("Error", "Logout failed. Try again.", "error");
      }
    }
  };

  useEffect(() => {
    // 1. Read from localStorage
    const storedAUID = localStorage.getItem('AUID') || localStorage.getItem('agentCode');
    try {
      const savedUser = JSON.parse(localStorage.getItem('agentProfile') || localStorage.getItem('user') || '{}');
      if (savedUser && (savedUser.agentCode || savedUser.FirstName || savedUser.name)) {
        const fullName = `${savedUser.FirstName || ''} ${savedUser.LastName || ''}`.trim() || savedUser.name || '';
        setAgentProfile((prev) => ({
          ...prev,
          name: fullName || prev.name,
          agentCode: savedUser.agentCode || savedUser.code || prev.agentCode,
          memberId: savedUser.memberId || prev.memberId,
          branchName: savedUser.branchName || prev.branchName,
          branchCode: savedUser.branchCode || prev.branchCode,
          designationName: savedUser.designationName || prev.designationName,
          agentStatus: savedUser.agentStatus || prev.agentStatus || 'Active',
          mobileNo: savedUser.MobileNo || savedUser.mobile || savedUser.phone || prev.mobileNo,
          email: savedUser.Email || savedUser.email || prev.email,
        }));
      }
    } catch (e) {
      // ignore
    }

    // 2. Fetch fresh agent details from API
    if (storedAUID) {
      axios
        .get(`${BASE_URL}/agents?IntroCode=${storedAUID}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        })
        .then((res) => {
          let list = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.agents || []);
          const found = list.find((a) => {
            const codes = [a.agentCode, a.AgentCode, a.agent_code, a.memberId, a.MemberNo, a.code]
              .map((v) => String(v || '').toLowerCase().trim());
            return codes.includes(storedAUID.toLowerCase());
          });
          if (found) {
            const fullName = `${found.FirstName || found.first_name || ''} ${found.LastName || found.last_name || ''}`.trim() || found.name || found.agentName || '';
            setAgentProfile((prev) => ({
              ...prev,
              name: fullName || prev.name,
              agentCode: found.agentCode || found.AgentCode || prev.agentCode,
              memberId: found.memberId || found.MemberNo || prev.memberId,
              branchName: found.branchName || found.BranchName || prev.branchName,
              branchCode: found.branchCode || found.BranchCode || prev.branchCode,
              designationName: found.designationName || found.DesignationName || prev.designationName,
              agentStatus: found.agentStatus || found.status || prev.agentStatus,
              mobileNo: found.MobileNo || found.mobile || found.phone || prev.mobileNo,
              email: found.Email || found.email || prev.email,
            }));
          }
        })
        .catch((err) => {
          console.log('Background agent detail fetch skipped:', err);
        });
    }
  }, []);

  const renderContent = () => {
    switch (index) {
      case 0:
        return <FirstRoute />;
      case 1:
        return <SecondRoute />;
      default:
        return null;
    }
  };

  useEffect(() => {
    const handlePopState = (event) => {
      event.preventDefault();

      Swal.fire({
        title: "Do you want to logout?",
        text: "You'll be logged out of this session.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, go back",
        cancelButtonText: "Stay here",
        reverseButtons: true,
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.removeItem('AUID');
          navigate('/login');
        } else {
          // push user back to current route
          navigate(window.location.pathname, { replace: true });
        }
      });
    };

    // force pushState so that back button always fires popstate
    window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#ffffff', overflowX: 'hidden' }}>
      {/* Header Bar with Agent Profile Info */}
      <div
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 56,
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E3DAC8',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Agent Profile Left Info */}
        <div
          onClick={() => setShowProfileModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 8,
            maxWidth: '65%',
          }}
          title="Click to view Agent Profile"
        >
          {/* Avatar Icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#385FBF',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {agentProfile.name ? agentProfile.name.charAt(0).toUpperCase() : <i className="fa-solid fa-user-tie" />}
          </div>

          {/* Name & Code */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1e293b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {agentProfile.name || 'Agent'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  backgroundColor: '#e6f4ea',
                  color: '#137333',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                {agentProfile.agentStatus || 'Active'}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: '#b4a383',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 2,
              }}
            >
              ID: {agentProfile.agentCode || 'N/A'} {agentProfile.designationName ? `• ${agentProfile.designationName}` : ''}
            </span>
          </div>

          <i className="fa-solid fa-chevron-down" style={{ fontSize: 9, color: '#94a3b8', marginLeft: 2 }} />
        </div>

        {/* Right Action Icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          {/* View Profile Icon */}
          <button
            onClick={() => setShowProfileModal(true)}
            style={{
              background: '#fdfbf7',
              border: '1px solid #E3DAC8',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#b4a383',
            }}
            title="View Full Profile Details"
          >
            <i className="fa-solid fa-id-badge" style={{ fontSize: 15 }} />
          </button>

          <button
            onClick={() => navigate('/requests')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Requests"
          >
            <IoListCircleOutline size={26} color="#b4a383" />
          </button>

          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Logout"
          >
            <IoLogOutOutline size={26} color="#b4a383" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
        {['Home', 'Wallet'].map((title, idx) => (
          <div
            key={idx}
            onClick={() => setIndex(idx)}
            style={{
              flex: 1,
              fontSize: 15,
              padding: '10px 0',
              textAlign: 'center',
              cursor: 'pointer',
              fontWeight: 'bold',
              color: index === idx ? '#b4a383' : '#a09886',
              borderBottom: index === idx ? '3px solid #b4a383' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {title}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div>{renderContent()}</div>

      {/* Agent Profile Details Modal */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: '#385FBF',
                padding: '20px 20px 16px',
                color: '#ffffff',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <button
                onClick={() => setShowProfileModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <IoCloseOutline size={22} />
              </button>

              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  color: '#385FBF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 22,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  flexShrink: 0,
                }}
              >
                {agentProfile.name ? agentProfile.name.charAt(0).toUpperCase() : <i className="fa-solid fa-user-tie" />}
              </div>

              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {agentProfile.name || 'Agent'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, opacity: 0.9 }}>
                    Code: <strong>{agentProfile.agentCode || 'N/A'}</strong>
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      backgroundColor: '#e6f4ea',
                      color: '#137333',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}
                  >
                    {agentProfile.agentStatus || 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Body / Details */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Agent Profile Details
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  backgroundColor: '#f8fafc',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Agent Code</span>
                  <strong style={{ fontSize: 13, color: '#1e293b' }}>{agentProfile.agentCode || 'N/A'}</strong>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Member ID</span>
                  <strong style={{ fontSize: 13, color: '#1e293b' }}>{agentProfile.memberId || 'N/A'}</strong>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Designation</span>
                  <strong style={{ fontSize: 13, color: '#1e293b' }}>{agentProfile.designationName || 'Agent'}</strong>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Branch</span>
                  <strong style={{ fontSize: 13, color: '#1e293b' }}>
                    {agentProfile.branchName ? `${agentProfile.branchName} (${agentProfile.branchCode || ''})` : 'N/A'}
                  </strong>
                </div>

                {agentProfile.mobileNo && (
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Mobile No</span>
                    <strong style={{ fontSize: 13, color: '#1e293b' }}>{agentProfile.mobileNo}</strong>
                  </div>
                )}

                {agentProfile.email && (
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Email</span>
                    <strong style={{ fontSize: 13, color: '#1e293b', wordBreak: 'break-all' }}>{agentProfile.email}</strong>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  onClick={() => setShowProfileModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#de2b32',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <IoLogOutOutline size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
