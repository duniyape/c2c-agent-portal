import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { BASE_URL } from '../config/api';

const CommissionSlabList = () => {
  const navigate = useNavigate();
  const [slabs, setSlabs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Naya dropdown state 
  // 1 = First Year only
  // 2 = First & Second Year
  // 3 = First, Second, & Third Year
  const [visibleYears, setVisibleYears] = useState(3);

  useEffect(() => {
    fetchSlabs();
  }, []);

  const fetchSlabs = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/commission-slabs`);
      if (res.data && res.data.success) {
        setSlabs(res.data.data || []);
      } else {
        toast.error('Failed to fetch slabs');
      }
    } catch (error) {
      console.error('Error fetching commission slabs:', error);
      toast.error('Network Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#fcfaf5', fontFamily: 'Arial' }}>
      
      {/* Header */}
      <h2 style={{ textAlign: 'center', color: '#b4a383', fontSize: '18px', padding: '20px 20px 10px', margin: '0', position: 'relative', backgroundColor: 'white', borderBottom: '1px solid #eee' }}>
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
        Commission Slabs
      </h2>

      {/* Filter Options */}
      <div style={{ backgroundColor: 'white', padding: '15px 20px', borderBottom: '1px solid #E3E3E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>Show Commission For:</span>
        <select 
          value={visibleYears} 
          onChange={(e) => setVisibleYears(Number(e.target.value))}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #E3DAC8',
            backgroundColor: '#fcfaf5',
            color: '#333',
            outline: 'none',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          <option value={1}>1st Year Only</option>
          <option value={2}>Up to 2nd Year</option>
          <option value={3}>Up to 3rd Year (All)</option>
        </select>
      </div>

      <div style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>Loading Slabs...</div>
        ) : slabs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>No commission slabs found.</div>
        ) : (
          slabs.map((slab) => (
            <div key={slab._id} style={{
              backgroundColor: 'white',
              border: '1px solid #E3DAC8',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#333', fontSize: '16px' }}>{slab.productName}</div>
                  <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Type: {slab.productType}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ 
                    backgroundColor: slab.status === 'active' ? '#e5f7ee' : '#ffe5e5', 
                    color: slab.status === 'active' ? '#27ae60' : '#c0392b', 
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: 'bold' 
                  }}>
                    {slab.status ? slab.status.toUpperCase() : 'ACTIVE'}
                  </span>
                  <span style={{ marginTop: '5px', fontSize: '12px', color: '#555', fontWeight: 'bold' }}>
                    Year: {slab.year}
                  </span>
                </div>
              </div>

              {/* Levels Display */}
              <div>
                <h4 style={{ fontSize: '14px', color: '#b4a383', marginBottom: '10px', marginTop: '15px' }}>Commission Levels</h4>
                {slab.levels && slab.levels.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {slab.levels.map((lvl, index) => (
                      <div key={index} style={{
                        backgroundColor: '#f9f9f9',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        borderLeft: '4px solid #b4a383'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                          Level {lvl.level}: {lvl.levelName || 'N/A'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                          {visibleYears >= 1 && <span>1st Yr: <b>{lvl.firstYear}%</b></span>}
                          {visibleYears >= 2 && <span>2nd Yr: <b>{lvl.secondYear}%</b></span>}
                          {visibleYears >= 3 && <span>3rd Yr: <b>{lvl.thirdYear}%</b></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#999' }}>No levels mapped</div>
                )}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default CommissionSlabList;
