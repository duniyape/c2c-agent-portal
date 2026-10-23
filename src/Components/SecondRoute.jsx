import React, { useEffect, useState, useCallback } from "react";
import moment from "moment";
import { useLoader } from "../loader/LoaderContext";
import { toast } from "react-toastify";
import axios from "axios";
import { BASE_URL, DOMAIN, API_URL } from "../config/api";
import { compressImage } from "../utils/imageCompressor";

const WalletScreen = () => {
  const { showLoader, hideLoader } = useLoader();

  // Active Tab: 'limit' | 'wallet'
  const [activeTab, setActiveTab] = useState('limit');

  // Limit Wallet States
  const [userdata, setuserdata] = useState({});
  const [apiTransactions, setApiTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [walletId, setWalletId] = useState(null);

  // Saving Wallet States
  const [savingWalletData, setSavingWalletData] = useState(null);
  const [savingWalletId, setSavingWalletId] = useState(null);
  const [savingTransactions, setSavingTransactions] = useState([]);
  const [savingCurrentPage, setSavingCurrentPage] = useState(1);

  // Agent UID from LocalStorage
  const [UID, setUID] = useState('');
  useEffect(() => {
    setUID(localStorage.getItem("AUID") || '');
  }, []);

  // Modal & Deposit Form States
  const [openlink, setopenlink] = useState(false);
  const [amount, setamount] = useState('');
  const [proofurl, setproofurl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [compressingProof, setCompressingProof] = useState(false);
  const [loaderreq, setloaderreq] = useState(false);
  const [bankledger, setbankledger] = useState('');
  const [lData, setlData] = useState([]);

  // Fetch Ledger Data for Bank Dropdown from ${API_URL}/ledgers
  const getData = async () => {
    const api = `${API_URL}/ledgers`;
    try {
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      const res = await axios.get(api, { timeout: 30000, headers });
      if (res && res.data) {
        const list = Array.isArray(res.data)
          ? res.data
          : (res.data.data || Object.values(res.data));
        setlData(list);
      }
    } catch (error) {
      console.error('Error fetching bank ledger data:', error);
    }
  };

  useEffect(() => {
    getData();
  }, []);

  // 1. Fetch Limit Wallet Details
  const fetchWalletDetails = useCallback(async () => {
    if (!UID) return;
    try {
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      const listRes = await axios.get(`${BASE_URL}/wallet/list`, { timeout: 30000, headers });
      const wallets = listRes.data?.data || [];

      const match = wallets.find(w => 
        (w.agentCode || '').toLowerCase() === UID.toLowerCase() ||
        (w.agent_id || '').toLowerCase() === UID.toLowerCase()
      );

      if (match) {
        const detailsRes = await axios.get(`${BASE_URL}/wallet/details?wallet_id=${match._id}`, { timeout: 30000, headers });

        if (detailsRes.data && detailsRes.data.success && detailsRes.data.data?.wallet) {
          const w = detailsRes.data.data.wallet;
          const mappedData = {
            ...w,
            Amount: w.creditLimit || 0,
            Balance: w.availableCredit || 0,
            MemberName: w.agentName || w.MemberName || '',
            LoanCode: w.walletNumber || w.LoanCode || '',
            BranchCode: w.branchCode || w.BranchCode || '',
          };

          setuserdata(mappedData);
          setWalletId(match._id);

          // Once agentMongoId is identified, cache and fetch saving wallet directly
          if (w.agent_id) {
            localStorage.setItem('agent_id', w.agent_id);
            fetchSavingWalletDetails(w.agent_id);
          }
        }
      } else {
        console.warn('No limit wallet found for agent:', UID);
      }
    } catch (error) {
      console.error('Error fetching limit wallet details:', error);
    }
  }, [UID]);

  useEffect(() => {
    fetchWalletDetails();
  }, [fetchWalletDetails]);

  // 2. Fetch Limit Wallet Transactions
  const fetchApiTransactions = useCallback(async () => {
    if (!walletId) return;
    try {
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      const res = await axios.get(`${BASE_URL}/wallet/transactions?wallet_id=${walletId}&page=${currentPage}&limit=10`, { timeout: 30000, headers });

      if (res.data && res.data.success) {
        setApiTransactions(res.data.data || []);
        const calcPages = res.data.total_pages || Math.ceil((res.data.total_count || 1) / 10) || 1;
        setTotalPages(calcPages);
      }
    } catch (err) {
      console.error('Error fetching limit transactions:', err);
    }
  }, [walletId, currentPage]);

  useEffect(() => {
    fetchApiTransactions();
  }, [fetchApiTransactions]);

  // 3. Fetch Saving Wallet Details & Transactions directly by agent_id
  const fetchSavingWalletDetails = useCallback(async (agentMongoId) => {
    const aid = agentMongoId || userdata?.agent_id || localStorage.getItem('agent_id');
    if (!aid) return;
    try {
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      const res = await axios.get(`${BASE_URL}/saving-wallet/details?agent_id=${aid}`, { timeout: 30000, headers });
      if (res.data?.success && res.data?.data) {
        if (res.data.data.wallet) {
          setSavingWalletData(res.data.data.wallet);
          setSavingWalletId(res.data.data.wallet._id);
        }
        if (res.data.data.transactions) {
          setSavingTransactions(res.data.data.transactions);
        }
      }
    } catch (err) {
      console.error('Error fetching saving wallet details directly by agent_id:', err);
    }
  }, [userdata?.agent_id]);

  // 4. Fetch Saving Wallet Transactions
  const fetchSavingTransactions = useCallback(async (sWalletId) => {
    const targetId = sWalletId || savingWalletId;
    const aid = userdata?.agent_id || localStorage.getItem('agent_id');
    try {
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      if (aid) {
        const res = await axios.get(`${BASE_URL}/saving-wallet/details?agent_id=${aid}`, { timeout: 30000, headers });
        if (res.data?.success && res.data?.data) {
          if (res.data.data.wallet) {
            setSavingWalletData(res.data.data.wallet);
            setSavingWalletId(res.data.data.wallet._id);
          }
          if (res.data.data.transactions) {
            setSavingTransactions(res.data.data.transactions);
          }
          return;
        }
      }
      if (targetId) {
        const res = await axios.get(`${BASE_URL}/saving-wallet/transactions?wallet_id=${targetId}`, { timeout: 30000, headers });
        if (res.data && res.data.success) {
          setSavingTransactions(res.data.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching saving wallet transactions:', err);
    }
  }, [savingWalletId, userdata?.agent_id]);

  useEffect(() => {
    if (activeTab === 'wallet') {
      const aid = userdata?.agent_id || localStorage.getItem('agent_id');
      if (aid) {
        fetchSavingWalletDetails(aid);
      } else if (savingWalletId) {
        fetchSavingTransactions(savingWalletId);
      }
    }
  }, [activeTab, savingWalletId, userdata?.agent_id, fetchSavingTransactions, fetchSavingWalletDetails]);

  // Handle open deposit modal
  const handleOpenDepositModal = () => {
    if (activeTab === 'limit') {
      const calcAmount = userdata.Amount !== undefined && userdata.Balance !== undefined
        ? Math.max(0, userdata.Amount - userdata.Balance).toFixed(2)
        : '';
      setamount(calcAmount);
    } else {
      setamount('');
    }
    setSelectedFile(null);
    setopenlink(true);
  };

  // Submit Deposit Request (Limit or Saving Wallet)
  const requestpost = async () => {
    const isSaving = activeTab === 'wallet';
    const depositAmount = parseFloat(amount);

    if (!depositAmount || depositAmount <= 0) {
      toast.error("Please enter a valid deposit amount");
      return;
    }

    if (!isSaving) {
      const maxAllowed = userdata.Amount !== undefined && userdata.Balance !== undefined
        ? userdata.Amount - userdata.Balance
        : null;

      if (maxAllowed !== null && depositAmount > maxAllowed) {
        toast.error(`Amount cannot exceed ₹${maxAllowed.toFixed(2)}`);
        return;
      }
    }

    if (!bankledger) {
      toast.error("Please select a bank");
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a document/slip to upload");
      return;
    }

    showLoader();
    setloaderreq(true);

    try {
      // 1. Ensure proof image is compressed (< 100KB) to avoid Nginx 1MB 413 error
      let fileToUpload = selectedFile;
      if (fileToUpload && typeof fileToUpload === 'object') {
        fileToUpload = await compressImage(fileToUpload);
      }

      const formData = new FormData();
      formData.append("image", fileToUpload, fileToUpload?.name || "slip.jpg");

      const uploadRes = await axios.post(`${DOMAIN}/duniyape/aws/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const docUrl = uploadRes.data?.url;
      if (!docUrl) {
        throw new Error(uploadRes.data?.error || uploadRes.data?.message || "Failed to upload document");
      }

      setproofurl(docUrl);

      // 2. Bank details
      const selectedBank = lData.find((item) =>
        item.Code === bankledger || item._id === bankledger || item.Pushkey === bankledger
      );
      const bankName = selectedBank ? selectedBank.LedgerName : "";

      // 3. Post to respective backend endpoint
      if (isSaving) {
        const payload = {
          amount: depositAmount,
          agent_id: savingWalletData?.agent_id || userdata?.agent_id || UID,
          wallet_id: savingWalletData?._id || savingWalletId,
          bank_name: bankName,
          bank_ledger_id: bankledger,
          doc_url: docUrl,
        };

        const res = await axios.post(`${BASE_URL}/saving-wallet/add-money-requests`, payload, {
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (res.data && res.data.success) {
          toast.success(res.data.message || "Saving wallet deposit request submitted successfully");
          setopenlink(false);
          setSelectedFile(null);
          setproofurl(null);
          setbankledger("");

          // Refresh saving wallet
          fetchSavingWalletDetails(savingWalletData?.agent_id || userdata?.agent_id);
          fetchSavingTransactions(savingWalletData?._id || savingWalletId);
        } else {
          toast.error(res.data?.message || "Failed to submit request");
        }
      } else {
        const payload = {
          amount: depositAmount,
          agent_id: userdata.agent_id || UID,
          bank_name: bankName,
          bank_ledger_id: bankledger,
          doc_url: docUrl,
        };

        const res = await axios.post(`${BASE_URL}/wallet/add-money-requests`, payload, {
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (res.data && res.data.success) {
          toast.success(res.data.message || "Limit deposit request submitted successfully");
          setopenlink(false);
          setSelectedFile(null);
          setproofurl(null);
          setbankledger("");

          // Refresh limit wallet
          fetchWalletDetails();
          fetchApiTransactions();
        } else {
          toast.error(res.data?.message || "Failed to submit request");
        }
      }
    } catch (error) {
      console.error("Error submitting deposit request:", error);
      let errMsg = "Failed to submit request";
      if (error?.response?.status === 413) {
        errMsg = "Deposit slip file is too large. Please select a smaller photo or screenshot.";
      } else if (error.message === "Network Error") {
        errMsg = "Network Error: Upload failed. Please check your internet connection or image size.";
      } else if (error.response?.data?.message) {
        errMsg = error.response.data.message;
      } else if (error.response?.data?.error) {
        errMsg = error.response.data.error;
      } else if (error.message) {
        errMsg = error.message;
      }
      toast.error(errMsg);
    } finally {
      setloaderreq(false);
      hideLoader();
    }
  };

  // Helper values for current active tab
  const isSaving = activeTab === 'wallet';
  const memberName = isSaving
    ? (savingWalletData?.agentName || userdata.MemberName || '')
    : (userdata.MemberName || '');
  const accountCode = isSaving
    ? (savingWalletData?.walletNumber || 'Saving Wallet')
    : (userdata.LoanCode || '');
  const currentBalance = isSaving
    ? (savingWalletData?.balance ?? 0)
    : (userdata.Balance ?? 0);

  // Pagination for saving wallet
  const savingPageSize = 10;
  const savingTotalPages = Math.max(1, Math.ceil(savingTransactions.length / savingPageSize));
  const paginatedSavingTxns = savingTransactions.slice(
    (savingCurrentPage - 1) * savingPageSize,
    savingCurrentPage * savingPageSize
  );

  return (
    <div style={styles.container}>
      {/* ── TOP TABS / PILLS ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
        <div style={{
          display: 'flex',
          backgroundColor: '#EAE3D3',
          borderRadius: '9999px',
          padding: '4px',
          gap: '6px',
          width: '100%',
          maxWidth: '380px',
          border: '1px solid #d4cbb8'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('limit')}
            style={{
              flex: 1,
              padding: '10px 18px',
              borderRadius: '9999px',
              border: 'none',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              backgroundColor: activeTab === 'limit' ? '#514579' : 'transparent',
              color: activeTab === 'limit' ? '#ffffff' : '#6b7280',
              boxShadow: activeTab === 'limit' ? '0 3px 10px rgba(81, 69, 121, 0.35)' : 'none'
            }}
          >
            Limit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            style={{
              flex: 1,
              padding: '10px 18px',
              borderRadius: '9999px',
              border: 'none',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              backgroundColor: activeTab === 'wallet' ? '#514579' : 'transparent',
              color: activeTab === 'wallet' ? '#ffffff' : '#6b7280',
              boxShadow: activeTab === 'wallet' ? '0 3px 10px rgba(81, 69, 121, 0.35)' : 'none'
            }}
          >
            Wallet
          </button>
        </div>
      </div>

      {/* ── HEADER CARD ─────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.profileRow}>
          {memberName && (
            <div style={styles.avatar}>
              {memberName.split(' ').map(word => word.charAt(0).toUpperCase()).join('')}
            </div>
          )}
          <div style={styles.userInfo}>
            <div><strong>{memberName}</strong></div>
            <div style={{ color: '#555', fontSize: '13px' }}>{accountCode}</div>
          </div>
        </div>
        <div style={styles.balanceRow}>
          Current Balance: <span style={styles.balanceValue}>₹{currentBalance}</span>
        </div>
        {!isSaving ? (
          <div style={styles.limitText}>Total Limit: ₹{userdata.Amount || 0}</div>
        ) : (
          <div style={styles.limitText}>
            Total Deposited: ₹{savingWalletData?.totalDeposit ?? 0}
          </div>
        )}
        <button onClick={handleOpenDepositModal} style={styles.depositBtn}>
          Bank Deposit
        </button>
      </div>

      {/* ── TRANSACTIONS TITLE ──────────────────────────────── */}
      <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#514579' }}>
        {isSaving ? "Saving Wallet Transactions" : "Wallet Transactions"}
      </h3>

      {/* ── TRANSACTIONS LIST ───────────────────────────────── */}
      {!isSaving ? (
        // LIMIT TRANSACTIONS (PAGINATED FROM API)
        <>
          {apiTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#777' }}>
              No transactions found
            </div>
          ) : (
            apiTransactions.map((item, index) => {
              const isWithdraw = item.type === 'withdraw';
              return (
                <div key={`api-${index}`} style={{ ...styles.transaction, backgroundColor: '#F5F1E7' }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ display: 'grid', placeItems: 'center', background: 'white', borderRadius: "50%", width: 32, height: 32, marginRight: 10 }}>
                        <span style={{ fontSize: 18, fontWeight: "bold", color: isWithdraw ? 'red' : 'green' }}>
                          {isWithdraw ? "↑" : "↓"}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                          {item.type ? item.type.replace(/_/g, ' ') : 'Transaction'} {item.status ? `( ${item.status} )` : ''}
                        </span>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {item.created_at ? moment(item.created_at).format("MMM Do YY, h:mm a") : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: "bold", color: isWithdraw ? 'red' : 'green', fontSize: 15 }}>
                    {isWithdraw ? '-' : '+'}{item.amount ? item.amount : 0}
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Controls for Limit */}
          {totalPages > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #ccc', marginBottom: '15px' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ ...styles.depositBtn, marginTop: 0, opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Prev
              </button>
              <span style={{ fontWeight: 'bold' }}>Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{ ...styles.depositBtn, marginTop: 0, opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        // SAVING WALLET TRANSACTIONS (PAGINATED CLIENT-SIDE)
        <>
          {paginatedSavingTxns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#777' }}>
              No saving wallet transactions found
            </div>
          ) : (
            paginatedSavingTxns.map((item, index) => {
              const isWithdraw = item.type === 'withdraw';
              const isPending = item.status === 'pending';
              const isRejected = item.status === 'rejected';

              let iconSymbol = isWithdraw ? "↑" : "↓";
              let iconColor = isWithdraw ? "red" : (isPending ? "#918405" : "green");
              if (isRejected) {
                iconSymbol = "✕";
                iconColor = "red";
              }

              let amountColor = isWithdraw ? "red" : (isPending ? "#918405" : "green");
              if (isRejected) amountColor = "gray";

              return (
                <div key={`saving-${index}`} style={{ ...styles.transaction, backgroundColor: '#F5F1E7' }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ display: 'grid', placeItems: 'center', background: 'white', borderRadius: "50%", width: 32, height: 32, marginRight: 10 }}>
                        <span style={{ fontSize: 18, fontWeight: "bold", color: iconColor }}>
                          {iconSymbol}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                          {item.type ? item.type.replace(/_/g, ' ') : 'Transaction'} {item.status ? `( ${item.status} )` : ''}
                        </span>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {item.created_at ? moment(item.created_at).format("MMM Do YY, h:mm a") : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: "bold", color: amountColor, fontSize: 15 }}>
                    {isWithdraw ? '-' : '+'}{item.amount ? item.amount : 0}
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Controls for Saving Wallet */}
          {savingTotalPages > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #ccc', marginBottom: '15px' }}>
              <button 
                disabled={savingCurrentPage === 1}
                onClick={() => setSavingCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ ...styles.depositBtn, marginTop: 0, opacity: savingCurrentPage === 1 ? 0.5 : 1 }}
              >
                Prev
              </button>
              <span style={{ fontWeight: 'bold' }}>Page {savingCurrentPage} of {savingTotalPages}</span>
              <button 
                disabled={savingCurrentPage === savingTotalPages}
                onClick={() => setSavingCurrentPage(prev => Math.min(savingTotalPages, prev + 1))}
                style={{ ...styles.depositBtn, marginTop: 0, opacity: savingCurrentPage === savingTotalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ── BANK DEPOSIT MODAL ──────────────────────────────── */}
      {openlink && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 9999 }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '24px 20px',
              width: '100%',
              maxWidth: '500px',
              margin: 'auto',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#514579', textAlign: 'center', marginBottom: '16px' }}>
                {isSaving ? "Deposit into Saving Wallet" : "Deposit into Limit Wallet"}
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '16px',
                flexWrap: 'wrap'
              }}>
                <input
                  type="number"
                  placeholder={isSaving ? "Enter deposit amount" : "Amount"}
                  value={amount}
                  onChange={(e) => setamount(e.target.value)}
                  style={{
                    backgroundColor: '#F9F9F9',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '15px',
                    color: 'black',
                    padding: '10px 16px',
                    width: '65%',
                    minWidth: '180px'
                  }}
                />
                <button
                  onClick={requestpost}
                  disabled={loaderreq}
                  style={{
                    backgroundColor: loaderreq ? '#AAA' : '#514579',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: loaderreq ? 'not-allowed' : 'pointer',
                    width: '28%',
                    minWidth: '100px'
                  }}
                >
                  {loaderreq ? 'Submitting...' : 'Deposit'}
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: 16 }}>
                <div style={formItem}>
                  <label style={labelStyle}>Bank Name</label>
                  <select
                    value={bankledger}
                    onChange={(e) => setbankledger(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select Bank</option>
                    {(
                      lData.filter((item) =>
                        item.GroupName === 'Assets-Bank' ||
                        (item.GroupName && item.GroupName.toLowerCase().includes('bank'))
                      ).length > 0
                        ? lData.filter((item) =>
                            item.GroupName === 'Assets-Bank' ||
                            (item.GroupName && item.GroupName.toLowerCase().includes('bank'))
                          )
                        : lData
                    ).map((item, index) => (
                      <option key={item._id || item.Code || index} value={item.Code || item._id}>
                        {item.LedgerName}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={formItem}>
                  <label style={labelStyle}>Upload Proof / Slip</label>
                  <input
                    required
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (file) {
                        setCompressingProof(true);
                        try {
                          const compressed = await compressImage(file);
                          setSelectedFile(compressed);
                        } catch (err) {
                          console.warn('Compression fallback:', err);
                          setSelectedFile(file);
                        } finally {
                          setCompressingProof(false);
                        }
                      }
                    }}
                    style={inputStyle}
                  />
                  {compressingProof && (
                    <div style={{ fontSize: '12px', color: '#385FBF', marginTop: '4px' }}>
                      <i className="fa-solid fa-spinner fa-spin" /> Compressing image...
                    </div>
                  )}
                  {selectedFile && !compressingProof && (
                    <div style={{ fontSize: '12px', color: '#2e7d32', marginTop: '4px', fontWeight: 'bold' }}>
                      ✓ Ready: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setopenlink(false)}
                  style={{
                    backgroundColor: '#F2E4A8',
                    padding: '8px 24px',
                    borderRadius: '5px',
                    border: '1px solid #857326',
                    color: '#857326',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  Cancel / Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletScreen;

const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    padding: 10,
    maxWidth: 500,
    margin: "0 auto",
  },
  header: {
    backgroundColor: "#EAE3D3",
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  profileRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "#746161",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  userInfo: {
    fontSize: 14,
  },
  balanceRow: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    fontSize: 16,
  },
  balanceValue: {
    color: "green",
    fontWeight: "bold",
  },
  limitText: {
    fontSize: 13,
    marginTop: 10,
  },
  depositBtn: {
    backgroundColor: "#b29c78",
    padding: "8px 16px",
    border: "none",
    borderRadius: 5,
    marginTop: 10,
    cursor: "pointer",
    fontWeight: 'bold'
  },
  transaction: {
    backgroundColor: "#EAE3D3",
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
  },
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: 'bold',
  fontSize: '13px'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  fontSize: '14px',
  boxSizing: 'border-box'
};

const formItem = {
  flex: '1 1 48%',
  minWidth: '220px',
};
