import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { BASE_URL } from '../config/api';

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

const shimmerStyle = {
  backgroundColor: '#f6f7f8',
  backgroundImage: 'linear-gradient(to right, #eeeeee 0%, #dddddd 50%, #eeeeee 100%)',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite linear',
  borderRadius: 4,
};

const AgentList = () => {
  const navigate = useNavigate();

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const agentCode = localStorage.getItem('agentCode') || localStorage.getItem('AUID') || '';
      const url = agentCode ? `${BASE_URL}/agents?IntroCode=${agentCode}` : `${BASE_URL}/agents`;
      console.log(url)
      const res = await axios.get(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

      let list = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data?.data)) {
        list = res.data.data;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (res.data?.agents && Array.isArray(res.data.agents)) {
        list = res.data.agents;
      } else if (res.data && typeof res.data === 'object') {
        list = [res.data];
      }

      console.log('Parsed agent list:', list);
      setAgents(list);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to fetch agent list.');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const getAgentName = (ag) => {
    const fName = ag.FirstName || ag.first_name || '';
    const lName = ag.LastName || ag.last_name || '';
    return (
      ag.agentName ||
      ag.AgentName ||
      ag.name ||
      ag.Name ||
      ag.memberName ||
      ag.MemberName ||
      `${fName} ${lName}`.trim() ||
      'N/A'
    );
  };

  const filteredAgents = agents.filter((ag) => {
    const search = searchTerm.toLowerCase();
    const code = (ag.agentCode || ag.AgentCode || '').toLowerCase();
    const name = getAgentName(ag).toLowerCase();
    const phone = (ag.MobileNo || '').toLowerCase();
    return code.includes(search) || name.includes(search) || phone.includes(search);
  });

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: 'white', fontFamily: 'Arial' }}>
      <style>{shimmerKeyframes}</style>

      {/* Header */}
      <h2 style={{ textAlign: 'center', color: '#b4a383', fontSize: '18px', margin: '20px', position: 'relative' }}>
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
            marginLeft: '10px',
          }}
          onClick={() => navigate(-1)}
        />
        Agent List
      </h2>

      {/* Logged-in Agent Profile Card (Up side in Agent List) */}
      <div
        style={{
          margin: '0 20px 14px',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: 12,
          border: '1px solid #E3DAC8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: '#385FBF',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            {(localStorage.getItem('Name') || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              {localStorage.getItem('Name') || 'My Profile'}
            </div>
            <div style={{ fontSize: 11, color: '#b4a383', fontWeight: 600 }}>
              Agent Code: {localStorage.getItem('agentCode') || localStorage.getItem('AUID') || 'N/A'} {localStorage.getItem('designationName') ? `• ${localStorage.getItem('designationName')}` : ''}
            </div>
          </div>
        </div>
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
          {localStorage.getItem('agentStatus') || 'Active'}
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '0 20px 16px' }}>
        <input
          type="text"
          placeholder="Search by Code, Name or Phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid #E3DAC8',
            borderRadius: 10,
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
            color: '#333',
          }}
        />
      </div>

      {/* List */}
      <div style={{ padding: '0 20px 30px' }}>
        {loading ? (
          // Shimmer placeholders
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                border: '1px solid #E3E3E3',
                borderRadius: 15,
                padding: 20,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ ...shimmerStyle, width: 50, height: 50, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...shimmerStyle, height: 14, width: '60%' }} />
                <div style={{ ...shimmerStyle, height: 11, width: '40%' }} />
              </div>
            </div>
          ))
        ) : filteredAgents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 }}>
            No agents found.
          </div>
        ) : (
          filteredAgents.map((ag, idx) => (
            <div
              key={ag._id || idx}
              style={{
                border: '1px solid #E3E3E3',
                borderRadius: 15,
                padding: 20,
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedAgent(ag)}
            >
              {/* Left: Avatar + Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Avatar */}
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 8,
                    backgroundColor: '#E3DAC8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-user" style={{ color: '#b4a383', fontSize: 22 }} />
                </div>

                {/* Details */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                    {getAgentName(ag)}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {ag.agentCode || ag.AgentCode || 'N/A'}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {ag.MobileNo || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Right: Status Badge */}
              <span
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor:
                    (ag.agentStatus || '').toLowerCase() === 'inactive'
                      ? '#ffe5e5'
                      : '#e5f7ee',
                  color:
                    (ag.agentStatus || '').toLowerCase() === 'inactive'
                      ? '#c0392b'
                      : '#27ae60',
                }}
              >
                {ag.agentStatus || 'Active'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedAgent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedAgent(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px 20px 0 0',
              padding: 24,
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#b4a383', margin: 0 }}>Agent Details</h3>
              <button
                onClick={() => setSelectedAgent(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}
              >
                ✕
              </button>
            </div>

            {/* Fields */}
            {[
              { label: 'Agent Code', value: selectedAgent.agentCode || selectedAgent.AgentCode },
              { label: 'Name', value: getAgentName(selectedAgent) },
              { label: 'Mobile', value: selectedAgent.MobileNo },
              { label: 'Email', value: selectedAgent.Email },
              { label: 'Designation', value: selectedAgent.designationName },
              { label: 'Branch', value: selectedAgent.BranchName },
              { label: 'Status', value: selectedAgent.agentStatus || 'Active' },
              {
                label: 'Joining Date',
                value: selectedAgent.joiningDate
                  ? new Date(selectedAgent.joiningDate).toLocaleDateString()
                  : null,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: 14,
                }}
              >
                <span style={{ color: '#888', fontWeight: 500 }}>{label}</span>
                <span style={{ color: '#333', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>
                  {value || 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentList;
