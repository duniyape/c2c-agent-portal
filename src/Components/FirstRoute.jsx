import React from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ensureChannelPartner } from '../utils/channelPartnerHelper';

const FirstRoute = () => {
  const navigate = useNavigate();

  // Categorized sections exactly as requested
  const categories = [
    {
      title: 'Member Services',
      items: [
        { id: 3, name: 'Add Member', icon: 'fa-solid fa-user-plus', action: 'addmember' },
        { id: 9, name: 'Member List', icon: 'fa-solid fa-handshake', action: 'memberlist' },
      ],
    },
    {
      title: 'Agent & Commission',
      items: [
        { id: 5, name: 'Apply Agent', icon: 'fa-solid fa-user-secret', action: 'agent' },
        { id: 8, name: 'Agent List', icon: 'fa-solid fa-network-wired', action: 'agentsview' },
        { id: 4, name: 'Commission', icon: 'fa-solid fa-sack-dollar', action: 'commission' },
      ],
    },
    {
      title: 'Doctor & Channel Partner',
      items: [
        { id: 11, name: 'Dr. Appoint', icon: 'fa-solid fa-user-doctor', action: 'dr_appointment' },
        { id: 12, name: 'Appoint List', icon: 'fa-solid fa-clipboard-list', action: 'appointment_list' },
        { id: 13, name: 'Channel Ptr', icon: 'fa-solid fa-handshake-simple', action: 'channel-partner' },
      ],
    },
    {
      title: 'Loan Services',
      items: [
        { id: 2, name: 'Apply Loan', icon: 'fa-solid fa-landmark', action: 'applyloan' },
        { id: 1, name: 'Loan List', icon: 'fa-solid fa-list', action: 'loanlist' },
      ],
    },
    {
      title: 'Settings & Security',
      items: [
        { id: 7, name: 'TPIN', icon: 'fa-solid fa-user-lock', action: 'tpin_manage' },
        { id: 6, name: 'Change Pswd', icon: 'fa-solid fa-key', action: 'change' },
        { id: 10, name: 'Comm Slab', icon: 'fa-solid fa-layer-group', action: 'commission-slabs' },
      ],
    },
  ];

  const handleIconClick = async (item) => {
    // Check if user is trying to access Doctor Appointment or Appointment List
    if (item.action === 'dr_appointment' || item.action === 'appointment_list') {
      const allowed = await ensureChannelPartner(navigate);
      if (!allowed) return;
    }

    if (item.action) {
      navigate('/' + item.action.replace(/^\//, ''));
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Coming Soon',
        text: 'This feature will be available soon.',
        confirmButtonColor: '#385FBF',
      });
    }
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        padding: '16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontFamily: "'Overlock', Arial, sans-serif",
      }}
    >
      {categories.map((cat, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 14,
            padding: '14px 16px',
            border: '1px solid #eef2f6',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
          }}
        >
          {/* Category Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div
              style={{
                width: 4,
                height: 16,
                backgroundColor: '#385FBF',
                borderRadius: 2,
              }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: '#1e293b',
                letterSpacing: '0.01em',
              }}
            >
              {cat.title}
            </h3>
          </div>

          {/* Action Buttons Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 12,
            }}
          >
            {cat.items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleIconClick(item)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '8px 4px',
                  borderRadius: 8,
                  transition: 'background 0.2s ease, transform 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    backgroundColor: '#385FBF',
                    width: 46,
                    height: 46,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 10,
                    boxShadow: '0 4px 8px rgba(56, 95, 191, 0.2)',
                    marginBottom: 6,
                  }}
                >
                  <i className={item.icon} style={{ color: '#b4a383', fontSize: 22 }} />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#334155',
                    textAlign: 'center',
                    lineHeight: 1.25,
                  }}
                >
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FirstRoute;
