import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';
import moment from 'moment';
import { useLoader } from '../loader/LoaderContext';
import { DOMAIN, API_BASE_URL, BASE_URL } from '../config/api';
import { ensureChannelPartner } from '../utils/channelPartnerHelper';

/**
 * =========================================================================
 * ⚙️ API CONFIGURATION (CENTRALIZED FROM api.js)
 * =========================================================================
 */
const RAZORPAY_KEY = 'rzp_test_TlMQdAmmaO6PuE';

// Dynamic API caller that interfaces with primary server without triggering cross-origin fallback errors
const apiRequest = async (endpoint, method = 'get', payload = null) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = (DOMAIN || API_BASE_URL || '').replace(/\/+$/, '');
  const isNgrok = typeof baseUrl === 'string' && (baseUrl.includes('ngrok') || baseUrl.includes('ngrok-free.app'));

  const headers = {
    'Content-Type': 'application/json',
  };
  if (isNgrok) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  console.log(`[apiRequest] ${method.toUpperCase()} -> ${baseUrl}${cleanEndpoint}`);

  const res = await axios({
    url: `${baseUrl}${cleanEndpoint}`,
    method,
    data: payload,
    timeout: 45000,
    headers,
  });
  return res.data;
};

// Ensure Razorpay SDK is loaded
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const DrAppoint = () => {
  const navigate = useNavigate();
  const { showLoader, hideLoader } = useLoader();

  // Search mode state: 'id' or 'pincode'
  const [searchMode, setSearchMode] = useState('pincode');

  // Search inputs
  const [doctorIdInput, setDoctorIdInput] = useState('');
  const [pincodeInput, setPincodeInput] = useState('');

  // Search results
  const [searchedDoctor, setSearchedDoctor] = useState(null);
  const [pincodeDoctors, setPincodeDoctors] = useState([]);
  const [detectedBlock, setDetectedBlock] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Selected doctor for booking
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  // Booked appointment receipt state (stays on this page after booking)
  const [bookedAppointment, setBookedAppointment] = useState(null);

  // Dates & Slots from API
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Patient Details Form
  const [formData, setFormData] = useState({
    patientName: '',
    fatherName: '',
    mobileNumber: '',
    email: '',
    dob: '',
    age: '',
    gender: 'Male',
    pincode: '',
    city: '',
    state: '',
    symptoms: '',
    address: '',
  });

  const [isFetchingPin, setIsFetchingPin] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Agent Wallet Balance state
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletNumber, setWalletNumber] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [agentMongoId, setAgentMongoId] = useState('');
  const [walletDbId, setWalletDbId] = useState('');
  const [markupAmount, setMarkupAmount] = useState(0);

  // Payment Method & UPI Payment Link State ('wallet' or 'upi')
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);
  const [paymentLinkModalData, setPaymentLinkModalData] = useState(null);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Helper to extract clean human-readable agent code (e.g. AG001), NEVER a 24-char MongoDB ObjectId
  const getAgentCode = () => {
    const auid = (localStorage.getItem('AUID') || '').trim();
    if (auid && !/^[a-f\d]{24}$/i.test(auid)) return auid;
    const acode = (localStorage.getItem('agentCode') || '').trim();
    if (acode && !/^[a-f\d]{24}$/i.test(acode)) return acode;
    return 'AG001';
  };

  // Helper to extract clean numeric fee from selected doctor
  const getNumericFee = () => {
    if (!selectedDoctor) return 0;
    const feeRaw =
      selectedDoctor.appointmentfee ||
      selectedDoctor.fees ||
      selectedDoctor.doctorfee ||
      selectedDoctor.fee ||
      selectedDoctor.secondappointmentfee ||
      selectedDoctor.consultation_fee ||
      0;
    const cleaned = String(feeRaw).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return !isNaN(num) && num > 0 ? num : 0;
  };

  // Fetch Agent Saving Wallet Balance directly by agent_id
  const fetchAgentWallet = async () => {
    setWalletLoading(true);

    try {
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      let mongoId = agentMongoId || localStorage.getItem('agent_id');
      const rawAgentCode = getAgentCode();

      // If mongoId is not cached or invalid, resolve agent_id from agentCode
      if (!mongoId || !/^[a-f\d]{24}$/i.test(mongoId)) {
        try {
          const limitListRes = await axios.get(`${BASE_URL}/wallet/list`, {
            timeout: 20000,
            headers,
          });
          const limitWallets = limitListRes.data?.data || [];
          const match = limitWallets.find(
            (w) =>
              (w.agentCode || '').toLowerCase() === rawAgentCode.toLowerCase() ||
              (w.agent_id || '').toLowerCase() === rawAgentCode.toLowerCase()
          );
          if (match?.agent_id) {
            mongoId = match.agent_id;
            localStorage.setItem('agent_id', mongoId);
            setAgentMongoId(mongoId);
          }
        } catch (subErr) {
          console.warn('Error resolving agent Mongo ID for saving wallet:', subErr.message);
        }
      }

      if (mongoId) {
        // Directly fetch saving-wallet/details?agent_id=...
        const detailsRes = await axios.get(`${BASE_URL}/saving-wallet/details?agent_id=${mongoId}`, {
          timeout: 20000,
          headers,
        });
        if (detailsRes.data?.success && detailsRes.data?.data) {
          const respData = detailsRes.data.data;
          const wallet = respData.wallet;

          // Extract agent's allocated markup amount
          const mAmount = respData.agent?.markup_amount !== undefined && respData.agent?.markup_amount !== null
            ? Number(respData.agent.markup_amount)
            : 0;
          setMarkupAmount(mAmount);
          try {
            sessionStorage.setItem('c2c_agent_markup', String(mAmount));
            localStorage.setItem('c2c_agent_markup', String(mAmount));
          } catch (_) { }

          if (wallet) {
            const bal = wallet.balance !== undefined ? Number(wallet.balance) : 0;
            setWalletBalance(bal);
            setWalletNumber(wallet.walletNumber || '');
            if (wallet.agent_id) {
              setAgentMongoId(wallet.agent_id);
              localStorage.setItem('agent_id', wallet.agent_id);
            }
            if (wallet._id) setWalletDbId(wallet._id);
            return;
          }
        }
      }

      setWalletBalance(0);
      setWalletNumber('');
      setMarkupAmount(0);
    } catch (err) {
      console.warn('Error fetching agent saving wallet details:', err.message);
      setWalletBalance(0);
    } finally {
      setWalletLoading(false);
    }
  };

  // Check Channel Partner and preload Razorpay SDK and fetch agent wallet balance on component mount
  useEffect(() => {
    ensureChannelPartner(navigate);
    loadRazorpayScript();
    fetchAgentWallet();
  }, [navigate]);

  // Auto-calculate Age on DOB change
  const handleDobChange = (e) => {
    const selectedDob = e.target.value;
    if (selectedDob) {
      const birthDate = moment(selectedDob);
      const calculatedAge = moment().diff(birthDate, 'years');
      setFormData((prev) => ({
        ...prev,
        dob: selectedDob,
        age: calculatedAge >= 0 ? calculatedAge.toString() : '0',
      }));
    } else {
      setFormData((prev) => ({ ...prev, dob: '', age: '' }));
    }
  };

  // Auto-fetch City and State: check primary API first, then postal directory
  const handlePatientPinCodeChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: val }));

    if (val.length === 6) {
      setIsFetchingPin(true);
      try {
        // 1. Primary backend API
        try {
          const apiRes = await apiRequest(`/c2c_app/doctors/by-pincode?pincode=${val}`);
          if (apiRes && (apiRes.city || apiRes.district || apiRes.state)) {
            setFormData((prev) => ({
              ...prev,
              city: apiRes.city || apiRes.district || '',
              state: apiRes.state || '',
            }));
            setIsFetchingPin(false);
            return;
          }
        } catch (_) { }

        // 2. Postal directory API
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success' && Array.isArray(data[0].PostOffice) && data[0].PostOffice.length > 0) {
          const postOffice = data[0].PostOffice[0];
          setFormData((prev) => ({
            ...prev,
            city: postOffice.District || postOffice.Block || postOffice.Name || '',
            state: postOffice.State || '',
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            city: '',
            state: '',
          }));
          Swal.fire({
            icon: 'info',
            title: 'No Postal Record Found',
            text: `No record found for Pincode ${val}. Please enter City and State manually.`,
            confirmButtonColor: '#385FBF',
          });
        }
      } catch (err) {
        console.warn('Error fetching patient pincode details:', err);
      } finally {
        setIsFetchingPin(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Option 1: Search Doctor by ID (using /c2c_app/doctors/by-secondary-id?secondaryId=...)
  const handleSearchById = async (e) => {
    e?.preventDefault();
    const cleanId = doctorIdInput.trim();
    if (!cleanId) {
      Swal.fire('Required', 'Please enter a Doctor ID to search.', 'warning');
      return;
    }

    showLoader();
    setHasSearched(true);

    try {
      let found = null;

      // 1. Direct call to DOMAIN for doctor ID search
      const currentBase = DOMAIN || API_BASE_URL;
      const doctorIdApiUrl = `${currentBase}/c2c_app/doctors/by-secondary-id?secondaryId=${encodeURIComponent(cleanId)}`;
      console.log('Searching Doctor by ID from:', doctorIdApiUrl);

      try {
        const res = await axios.get(doctorIdApiUrl, {
          timeout: 8000,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        if (res.data && res.data.success && res.data.data) {
          found = res.data.data;
        } else if (res.data && res.data.data && !Array.isArray(res.data.data)) {
          found = res.data.data;
        }
      } catch (apiErr) {
        console.warn(`Direct doctor ID search from ${currentBase} error:`, apiErr.message);
      }

      if (found) {
        const feeNum = found.appointmentfee ? Number(found.appointmentfee) : 250;
        const normalizedDoctor = {
          ...found,
          id: found.secondaryId || cleanId,
          secondaryId: found.secondaryId || cleanId,
          mongoid: found.mongoid,
          doctor_name: found.doctor_name || found.name || 'Doctor',
          name: found.doctor_name || found.name || 'Doctor',
          specialization: found.specialization || found.specialty || 'General Consultant',
          specialty: found.specialization || found.specialty || 'General Consultant',
          appointmentfee: feeNum,
          fee: `₹${feeNum}`,
          appointmentdatelimit: found.appointmentdatelimit || '',
        };
        setSearchedDoctor(normalizedDoctor);
      } else {
        setSearchedDoctor(null);
        Swal.fire({
          icon: 'error',
          title: 'Doctor Not Found',
          text: `No doctor found with ID "${cleanId}".`,
          confirmButtonColor: '#385FBF',
        });
      }
    } catch (err) {
      console.error('Doctor search error:', err);
      Swal.fire('Error', 'Failed to search doctor. Please try again.', 'error');
    } finally {
      hideLoader();
    }
  };

  // Option 2: Search Doctors by Pincode
  const handleSearchByPincode = async (e) => {
    e?.preventDefault();
    const cleanPincode = pincodeInput.trim();
    if (!cleanPincode || cleanPincode.length !== 6) {
      Swal.fire('Invalid Pincode', 'Please enter a valid 6-digit Pincode.', 'warning');
      return;
    }

    showLoader();
    setHasSearched(true);

    try {
      const res = await apiRequest(`/c2c_app/doctors/by-pincode?pincode=${cleanPincode}`);

      if (res && res.success) {
        const rawList = res.data || [];
        const normalizedList = rawList.map((doc) => {
          const feeNum = doc.appointmentfee ? Number(doc.appointmentfee) : 250;
          return {
            ...doc,
            id: doc.secondaryId || doc.mongoid,
            secondaryId: doc.secondaryId || '',
            mongoid: doc.mongoid,
            doctor_name: doc.doctor_name || doc.name || 'Doctor',
            name: doc.doctor_name || doc.name || 'Doctor',
            specialization: doc.specialization || doc.specialty || 'General Consultant',
            specialty: doc.specialization || doc.specialty || 'General Consultant',
            appointmentfee: feeNum,
            fee: `₹${feeNum}`,
            appointmentdatelimit: doc.appointmentdatelimit || '',
          };
        });
        setPincodeDoctors(normalizedList);

        const locationParts = [res.city, res.district, res.state]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i);
        setDetectedBlock(locationParts.join(', ') || `Pincode ${res.pincode}`);

        if (normalizedList.length === 0) {
          Swal.fire({
            icon: 'info',
            title: 'No Doctors Found',
            text: `No doctors registered in Pincode ${cleanPincode}.`,
            confirmButtonColor: '#385FBF',
          });
        }
      } else {
        setPincodeDoctors([]);
        Swal.fire({
          icon: 'warning',
          title: 'Not Found',
          text: res?.message || `No doctors found for pincode ${cleanPincode}.`,
          confirmButtonColor: '#385FBF',
        });
      }
    } catch (err) {
      console.error('Pincode fetch error:', err);
      setPincodeDoctors([]);
      Swal.fire({
        icon: 'error',
        title: 'Connection Issue',
        text: `Unable to fetch doctors for pincode ${cleanPincode}. Please verify connection.`,
        confirmButtonColor: '#385FBF',
      });
    } finally {
      hideLoader();
    }
  };

  // Fetch Available Dates for Selected Doctor
  const fetchDoctorDates = async (doctorId, dateLimit) => {
    let dates = [];
    const maxDays = dateLimit && parseInt(dateLimit) > 0 ? parseInt(dateLimit) : 7;
    try {
      const res = await apiRequest(`/kalra_mindcare/fatch_date_and_time/date/${doctorId}`);

      let rawData = null;
      if (Array.isArray(res)) {
        rawData = res;
      } else if (res && res.data) {
        rawData = Array.isArray(res.data) ? res.data : (res.data.dates || res.data.data || Object.keys(res.data));
      }

      if (Array.isArray(rawData) && rawData.length > 0) {
        dates = rawData
          .map((d) => {
            if (typeof d === 'string') return d;
            if (d && typeof d === 'object') {
              if (d.enabled === false) return null;
              const val = d.id || d.date || d.day || d._id;
              return val ? moment(val).format('YYYY-MM-DD') : null;
            }
            return null;
          })
          .filter((d) => d && d !== 'Invalid date');
      }
    } catch (err) {
      console.warn('Doctor dates API info:', err.message);
    }

    // Limit dates to appointmentdatelimit if specified
    if (dates && dates.length > 0 && maxDays > 0) {
      dates = dates.slice(0, maxDays);
    }

    setAvailableDates(dates);
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
      fetchDoctorSlots(dates[0], doctorId);
    }
  };

  // Helper to check if a slot's time has already passed for today's date
  const isSlotPassed = (slotTitle, targetDate) => {
    if (!slotTitle || !targetDate) return false;
    // Only apply time expiry check if selected date is today
    if (!moment(targetDate).isSame(moment(), 'day')) {
      return false;
    }

    const str = typeof slotTitle === 'string' ? slotTitle : String(slotTitle);
    // Extract start time (e.g. from "10:00 AM - 11:00 AM" -> "10:00 AM")
    const startTimePart = str.split(/[-–—to]/i)[0].trim();
    if (!startTimePart) return false;

    const todayStr = moment().format('YYYY-MM-DD');
    const parsedTime = moment(`${todayStr} ${startTimePart}`, [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD H:mm',
    ]);

    if (parsedTime.isValid()) {
      return parsedTime.isBefore(moment());
    }
    return false;
  };

  // Fetch Time Slots for Selected Date & Doctor
  const fetchDoctorSlots = async (targetDate, doctorId) => {
    setLoadingSlots(true);
    let finalSlots = [];

    try {
      const res = await apiRequest(`/kalra_mindcare/fatch_date_and_time/${targetDate}/${doctorId}`);

      if (Array.isArray(res) && res.length > 0) {
        finalSlots = res;
      } else if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        finalSlots = res.data;
      }
    } catch (err) {
      console.warn('Doctor slots API info:', err.message);
    }

    // Normalize slots format strictly from API
    const formatted = finalSlots
      .map((s) => {
        if (typeof s === 'string') return { id: s, title: s, enabled: true };
        if (s && typeof s === 'object') {
          return {
            id: s.id || s.time || s._id || Object.values(s)[0],
            title: s.title || s.id || s.time,
            enabled: s.enabled !== false && s.enabled !== 'false',
          };
        }
        return null;
      })
      .filter(Boolean);

    setAvailableSlots(formatted);
    if (formatted.length > 0) {
      const firstAvailable = formatted.find(
        (slot) => slot.enabled && !isSlotPassed(slot.title || slot.id, targetDate)
      );
      setSelectedSlot(firstAvailable ? firstAvailable.id : '');
    } else {
      setSelectedSlot('');
    }
    setLoadingSlots(false);
  };

  // Handle Date Change from UI
  const handleDateSelection = (dStr) => {
    setSelectedDate(dStr);
    const docId = selectedDoctor?.mongoid || selectedDoctor?.id;
    if (docId) {
      fetchDoctorSlots(dStr, docId);
    }
  };

  // Doctor Selected
  const handleSelectDoctor = (doc) => {
    const feeNum = doc.appointmentfee ? Number(doc.appointmentfee) : 250;
    const formattedDoctor = {
      id: doc.secondaryId || doc.id || doc.mongoid || 'DOC',
      secondaryId: doc.secondaryId || '',
      mongoid: doc.mongoid || doc.id,
      name: doc.doctor_name || doc.name || 'Doctor',
      doctor_name: doc.doctor_name || doc.name || 'Doctor',
      specialty: doc.specialization || doc.specialty || 'General Consultant',
      specialization: doc.specialization || doc.specialty || 'General Consultant',
      hospital: detectedBlock || doc.city || 'Care Clinic',
      appointmentfee: feeNum,
      fee: `₹${feeNum}`,
      appointmentdatelimit: doc.appointmentdatelimit || '',
    };

    setSelectedDoctor(formattedDoctor);
    fetchDoctorDates(formattedDoctor.mongoid, formattedDoctor.appointmentdatelimit);

    // Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // STEP 1: VALIDATE & OPEN REVIEW MODAL
  const handleOpenReview = (e) => {
    e?.preventDefault();

    if (!selectedDoctor) {
      Swal.fire('Doctor Required', 'Please select a doctor first.', 'warning');
      return;
    }

    if (!formData.patientName.trim()) {
      Swal.fire('Missing Field', 'Please enter Patient Full Name.', 'warning');
      return;
    }

    if (!formData.fatherName.trim()) {
      Swal.fire('Missing Field', 'Please enter Father/Guardian Name.', 'warning');
      return;
    }

    if (!formData.mobileNumber.trim() || formData.mobileNumber.trim().length !== 10) {
      Swal.fire('Invalid Mobile', 'Please enter a valid 10-digit Mobile Number.', 'warning');
      return;
    }

    if (!formData.dob) {
      Swal.fire('Missing DOB', 'Please select Date of Birth.', 'warning');
      return;
    }

    if (!formData.pincode || formData.pincode.length !== 6) {
      Swal.fire('Invalid Pincode', 'Please enter a valid 6-digit Pincode.', 'warning');
      return;
    }

    if (!selectedSlot) {
      Swal.fire('Select Slot', 'Please select an appointment time slot.', 'warning');
      return;
    }

    if (isSlotPassed(selectedSlot, selectedDate)) {
      Swal.fire('Slot Expired', 'The selected time slot has already passed for today. Please select an upcoming slot.', 'warning');
      return;
    }

    // Address is OPTIONAL - Open Review Modal
    setShowReviewModal(true);
  };

  // Finalize booking success, store booked details for receipt and display modal
  const finalizeBookingSuccess = async ({
    appointmentNumber,
    appointmentIndex,
    paymentId = 'WALLET_' + Date.now(),
  }) => {
    hideLoader();

    // Save full appointment details so receipt stays on this page (no redirect away)
    setBookedAppointment({
      appointmentNumber,
      appointmentIndex: appointmentIndex !== null ? appointmentIndex : null,
      doctorName: selectedDoctor.name,
      specialization: selectedDoctor.specialization || selectedDoctor.specialty,
      doctorFee: selectedDoctor.fee,
      hospital: selectedDoctor.hospital || detectedBlock || 'Care Clinic',
      date: selectedDate,
      timeSlot: selectedSlot,
      patientName: formData.patientName,
      fatherName: formData.fatherName,
      age: formData.age,
      gender: formData.gender,
      mobileNumber: formData.mobileNumber,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      address: formData.address,
      symptoms: formData.symptoms,
      paymentId: paymentId || 'WALLET_CONFIRMED',
      bookingTime: moment().format('DD MMM YYYY, hh:mm A'),
    });

    // Show Success Receipt Modal with Backend Appointment Number / Index
    await Swal.fire({
      icon: 'success',
      title: 'Appointment Booked Successfully!',
      html: `
        <div style="background: #eff6ff; border: 1.5px dashed #3b82f6; border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: center;">
          <span style="font-size: 11px; color: #1e40af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Appointment Number</span>
          <h2 style="margin: 4px 0 0; color: #1d4ed8; font-size: 24px; font-weight: 800;">${appointmentNumber}</h2>
          ${appointmentIndex !== null && String(appointmentIndex) !== String(appointmentNumber)
          ? `<div style="margin-top: 6px;"><span style="background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">Appointment Index (Token): #${appointmentIndex}</span></div>`
          : ''
        }
        </div>
        <div style="text-align: left; font-size: 14px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <p style="margin: 4px 0;"><strong>Doctor:</strong> ${selectedDoctor.name}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${moment(selectedDate).format('Do MMMM YYYY')}</p>
          <p style="margin: 4px 0;"><strong>Time Slot:</strong> ${selectedSlot}</p>
          <p style="margin: 4px 0;"><strong>Payment / Ref ID:</strong> ${paymentId}</p>
          <hr style="margin: 8px 0; border: none; border-top: 1px dashed #cbd5e1;" />
          <p style="margin: 4px 0;"><strong>Patient:</strong> ${formData.patientName} (${formData.age} Yrs)</p>
          <p style="margin: 4px 0;"><strong>Mobile:</strong> +91 ${formData.mobileNumber}</p>
          <p style="margin: 4px 0;"><strong>Address:</strong> ${formData.address}, ${formData.city} (${formData.pincode})</p>
        </div>
      `,
      confirmButtonColor: '#385FBF',
      confirmButtonText: 'View Receipt',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchAgentWallet(); // Refresh wallet balance in background after successful booking
  };

  // STEP 2: AGENT CREATE ORDER & APPOINTMENT CONFIRMATION (EXECUTED AFTER REVIEW CONFIRMATION)
  const executeBookingAndPayment = async () => {
    // 0. Ensure Channel Partner is approved before booking
    const isApprovedCP = await ensureChannelPartner(navigate);
    if (!isApprovedCP) return;

    // 1. Strict validation: Wallet balance check against Total Payable (Fee + Markup)
    const numericFee = getNumericFee();
    const currentMarkup = Number(markupAmount || 0);
    const totalPayable = numericFee + currentMarkup;

    if (walletBalance !== null && walletBalance < totalPayable) {
      Swal.fire({
        icon: 'error',
        title: 'Insufficient Wallet Balance',
        html: `
          <div style="font-size: 14px; text-align: left; padding: 12px; background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 8px;">
            <p style="margin: 0 0 6px 0; color: #991b1b; font-weight: 700;">Insufficient balance in your wallet!</p>
            <p style="margin: 4px 0; color: #374151;">Available Balance: <strong style="color: #dc2626;">₹${Number(walletBalance || 0).toFixed(2)}</strong></p>
            <p style="margin: 4px 0; color: #374151;">Consultation Fee: ₹${numericFee.toFixed(2)}</p>
            ${currentMarkup > 0 ? `<p style="margin: 4px 0; color: #2563eb;">Markup Amount: ₹${currentMarkup.toFixed(2)}</p>` : ''}
            <p style="margin: 4px 0; color: #374151;">Total Payable: <strong style="color: #1e3a8a;">₹${totalPayable.toFixed(2)}</strong></p>
            <p style="margin: 4px 0; color: #374151;">Shortage: <strong style="color: #dc2626;">₹${(totalPayable - Number(walletBalance || 0)).toFixed(2)}</strong></p>
          </div>
          <p style="margin-top: 12px; font-size: 13px; color: #64748b;">Please recharge your wallet before booking this appointment.</p>
        `,
        confirmButtonColor: '#385FBF',
        confirmButtonText: 'OK',
      });
      return;
    }

    setShowReviewModal(false);

    const agentCode = getAgentCode();
    showLoader();

    // Resolve Mongo ObjectId for backend agent saving wallet lookup
    let targetAgentId = agentMongoId || localStorage.getItem('agent_id');
    let targetWalletId = walletDbId;
    if (!targetWalletId || !targetAgentId || !/^[a-f\d]{24}$/i.test(targetAgentId)) {
      try {
        const detailsRes = await axios.get(`${BASE_URL}/saving-wallet/details?agent_id=${targetAgentId || agentCode}`, {
          timeout: 20000,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (detailsRes.data?.success && detailsRes.data?.data?.wallet) {
          targetAgentId = detailsRes.data.data.wallet.agent_id || targetAgentId;
          targetWalletId = detailsRes.data.data.wallet._id || targetWalletId;
        }
      } catch (_) { }
    }

    const docId = selectedDoctor.mongoid || selectedDoctor.id;
    const appointmentPayload = {
      agent_id: agentCode,
      agent_code: agentCode,
      agentCode: agentCode,
      agentId: agentCode,
      agent_mongo_id: targetAgentId || '',
      wallet_id: targetWalletId || targetAgentId || agentCode,
      saving_wallet_id: targetWalletId || '',
      wallet_number: walletNumber || '',
      wallet_type: 'saving',
      mobile: formData.mobileNumber.trim(),
      patient_phone: formData.mobileNumber.trim(),
      doctor_id: docId,
      doctor_phone_id: docId,
      doctor_name: selectedDoctor.name,
      patient_name: formData.patientName.trim(),
      father_name: formData.fatherName.trim(),
      guardian_name: formData.fatherName.trim(),
      date: selectedDate,
      date_of_appointment: selectedDate,
      time: selectedSlot,
      time_slot: selectedSlot,
      email: formData.email.trim() || 'patient@care2connect.in',
      symptoms: formData.symptoms.trim() || 'Routine Consultation',
      age: formData.age || '25',
      timestamp: String(Math.floor(Date.now() / 1000)),
      dob: formData.dob,
      date_of_birth: formData.dob,
      city: formData.city || 'District Center',
      state: formData.state || 'Madhya Pradesh',
      pincode: formData.pincode,
      address: formData.address.trim() || 'Not Provided',
      sex: formData.gender,
      gender: formData.gender,
      vaccine: true,
      amount: Number(numericFee.toFixed(2)),
      total_amount: Number(totalPayable.toFixed(2)),
      payable_amount: Number(totalPayable.toFixed(2)),
      total_fee: Number(totalPayable.toFixed(2)),
      fee: numericFee,
      doctor_fee: numericFee,
      markup_amount: currentMarkup,
    };

    console.log('Initiating agent appointment order (/agent-create-order):', appointmentPayload);

    try {
      // Step 1: Call Backend Agent Create Order API (/c2c_app/agent-create-order)
      let orderRes = null;
      try {
        orderRes = await apiRequest('/c2c_app/agent-create-order', 'post', appointmentPayload);
      } catch (callErr) {
        // If backend returned a JSON error response (e.g. 404/400 with "Wallet not found", etc.)
        if (callErr.response?.data && (callErr.response.data.error || callErr.response.data.message)) {
          hideLoader();
          Swal.fire({
            icon: 'error',
            title: 'Booking Failed',
            text: callErr.response.data.error || callErr.response.data.message,
            confirmButtonColor: '#385FBF',
          });
          return;
        }

        // Only retry /agent-create-order if route not found (HTML response)
        if (callErr.response?.status === 404 && typeof callErr.response?.data === 'string') {
          orderRes = await apiRequest('/agent-create-order', 'post', appointmentPayload);
        } else {
          throw callErr;
        }
      }

      console.log('agent-create-order response from backend:', orderRes);

      // Check if backend returned an error in JSON body
      if (orderRes && (orderRes.success === false || orderRes.status === 'failed')) {
        hideLoader();
        Swal.fire({
          icon: 'error',
          title: 'Booking Failed',
          text: orderRes.error || orderRes.message || 'Unable to book appointment.',
          confirmButtonColor: '#385FBF',
        });
        return;
      }

      const orderData = orderRes?.data || orderRes || {};
      const orderId = orderData.id || orderData.order_id || orderRes?.id || orderRes?.order_id;

      // Extract appointment details if available
      const appointmentIndex =
        orderData.appointment_index !== undefined && orderData.appointment_index !== null
          ? orderData.appointment_index
          : orderData.appoint_index !== undefined && orderData.appoint_index !== null
            ? orderData.appoint_index
            : orderData.index_number !== undefined && orderData.index_number !== null
              ? orderData.index_number
              : null;

      const backendAppointNo =
        orderData.appoint_number ||
        orderData.appointment_number ||
        orderData.appointment_no ||
        orderData.appointment_id ||
        orderData.booking_id;

      const appointmentNumber =
        backendAppointNo ||
        (appointmentIndex !== null ? `No. ${appointmentIndex}` : `APPT-${Date.now().toString().slice(-6)}`);

      // If order creates appointment directly (e.g. from Agent Wallet) OR has no Razorpay orderId
      const isRazorpayOrder = typeof orderId === 'string' && orderId.startsWith('order_');

      if (!isRazorpayOrder) {
        // Direct booking completed via agent wallet - no verify API, no Razorpay popup needed
        await finalizeBookingSuccess({
          appointmentNumber,
          appointmentIndex,
          paymentId: orderData.payment_id || orderData.pay_id || 'WALLET_' + Date.now(),
        });
        return;
      }

      // If backend returned a Razorpay orderId, open Razorpay checkout
      let amountInPaise = orderData.amount || (selectedDoctor.appointmentfee || 250) * 100;
      let currency = orderData.currency || 'INR';

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window.Razorpay === 'undefined') {
        hideLoader();
        Swal.fire({
          icon: 'error',
          title: 'Payment Gateway Error',
          text: 'Unable to load Razorpay SDK. Please check your internet connection.',
          confirmButtonColor: '#385FBF',
        });
        return;
      }

      hideLoader();

      const options = {
        key: RAZORPAY_KEY,
        amount: amountInPaise.toString(),
        currency: currency,
        name: 'Care2Connect',
        description: `Doctor Appointment with ${selectedDoctor.name}`,
        order_id: orderId,
        prefill: {
          name: formData.patientName,
          contact: formData.mobileNumber,
          email: formData.email || '',
        },
        theme: {
          color: '#385FBF',
        },
        handler: async (response) => {
          showLoader();
          // Notice: /c2c_app/verify is removed as requested
          await finalizeBookingSuccess({
            appointmentNumber,
            appointmentIndex,
            paymentId: response.razorpay_payment_id || 'PAY_' + Date.now(),
          });
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal was closed by user');
            Swal.fire({
              icon: 'info',
              title: 'Payment Window Closed',
              text: 'The payment window was closed before completion.',
              confirmButtonColor: '#385FBF',
            });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (failResp) {
        console.error('Razorpay payment failed:', failResp.error);
        Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: failResp.error?.description || 'Payment was not successful. Please try again.',
          confirmButtonColor: '#385FBF',
        });
      });
      rzp.open();
    } catch (orderErr) {
      hideLoader();
      console.error('Agent order creation error:', orderErr);
      Swal.fire({
        icon: 'error',
        title: 'Booking Failed',
        text:
          orderErr.response?.data?.error ||
          orderErr.response?.data?.message ||
          orderErr.message ||
          'Server error occurred during booking.',
        confirmButtonColor: '#385FBF',
      });
    }
  };

  // STEP 2B: CREATE ONLINE / UPI PAYMENT LINK VIA API (/c2c_app/api/create-payment-link)
  const handleCreatePaymentLink = async () => {
    // 0. Ensure Channel Partner is approved before generating payment link
    const isApprovedCP = await ensureChannelPartner(navigate);
    if (!isApprovedCP) return;

    const numericFee = getNumericFee();
    const currentMarkup = Number(markupAmount || 0);
    const totalPayable = numericFee + currentMarkup;

    if (totalPayable <= 0) {
      Swal.fire('Invalid Fee', 'Consultation fee must be greater than 0.', 'warning');
      return;
    }

    if (!formData.patientName.trim()) {
      Swal.fire('Patient Name Required', 'Please enter patient name before generating payment link.', 'warning');
      return;
    }

    const cleanMobile = formData.mobileNumber.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      Swal.fire('Invalid Mobile', 'Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    setIsCreatingPaymentLink(true);
    showLoader();

    const agentCode = getAgentCode();
    const docId = selectedDoctor.mongoid || selectedDoctor.id;

    const linkPayload = {
      amount: Number(totalPayable.toFixed(2)),
      total_amount: Number(totalPayable.toFixed(2)),
      total_fee: Number(totalPayable.toFixed(2)),
      name: formData.patientName.trim(),
      patient_name: formData.patientName.trim(),
      mobile: cleanMobile,
      whatsapp_number: cleanMobile,
      email: formData.email?.trim() || undefined,
      description: `Doctor Consultation - ${selectedDoctor.name}`,
      reference_id: `APPT_${Date.now().toString().slice(-8)}`,
      agent_id: agentCode,
      agent_code: agentCode,
      agentId: agentCode,
      agentCode: agentCode,
      doctor_id: docId,
      doctor_phone_id: docId,
      doctor_name: selectedDoctor.name,
      doctor_fee: numericFee,
      fee: numericFee,
      markup_amount: currentMarkup,
      father_name: formData.fatherName?.trim() || '',
      guardian_name: formData.fatherName?.trim() || '',
      date: selectedDate,
      time: selectedSlot,
      patient_phone: cleanMobile,
      age: formData.age || '',
      dob: formData.dob || '',
      date_of_birth: formData.dob || '',
      sex: formData.gender || 'Male',
      pincode: formData.pincode,
      city: formData.city,
      state: formData.state,
      address: formData.address.trim(),
      symptoms: formData.symptoms.trim(),
      timestamp: String(Math.floor(Date.now() / 1000)),
    };

    console.log('Sending create-payment-link payload:', linkPayload);

    try {
      let res = null;
      try {
        res = await apiRequest('/c2c_app/api/create-payment-link', 'post', linkPayload);
      } catch (callErr) {
        if (callErr.response?.status === 404) {
          res = await apiRequest('/api/create-payment-link', 'post', linkPayload);
        } else {
          throw callErr;
        }
      }

      console.log('Payment link response:', res);

      if (res && (res.success || res.payment_url)) {
        const paymentUrl = res.payment_url || res.short_url || '';
        const paymentLinkId = res.payment_link_id || res.id || '';
        const appointmentId = res.appointment_id || res.appointment_reference || '';

        setPaymentLinkModalData({
          url: paymentUrl,
          paymentLinkId: paymentLinkId,
          appointmentId: appointmentId,
          appointmentReference: res.appointment_reference || '',
          amount: res.amount || totalPayable,
          doctorName: selectedDoctor.name,
          specialization: selectedDoctor.specialization || selectedDoctor.specialty || 'Consultant',
          patientName: formData.patientName,
          patientMobile: formData.mobileNumber,
          date: selectedDate,
          timeSlot: selectedSlot,
          status: res.payment_status || res.status || 'created',
        });

        setShowReviewModal(false);
        setShowPaymentLinkModal(true);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Payment Link Failed',
          text: res?.message || 'Unable to generate payment link. Please try again.',
          confirmButtonColor: '#385FBF',
        });
      }
    } catch (err) {
      console.error('Error generating payment link:', err);
      const targetBase = DOMAIN || API_BASE_URL;
      let errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      if (err.message === 'Network Error' || !err.response) {
        errMsg = `Network Error: Unable to reach backend server at ${targetBase}. Please verify the backend is running and hard-refresh your browser (Ctrl + Shift + R).`;
      }
      Swal.fire({
        icon: 'error',
        title: 'Payment Link Error',
        text: errMsg,
        confirmButtonColor: '#385FBF',
      });
    } finally {
      setIsCreatingPaymentLink(false);
      hideLoader();
    }
  };

  const handleCopyLink = async (text) => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShareWhatsApp = (data) => {
    if (!data || !data.url) return;
    const msg =
      `🏥 *Care2Connect - Doctor Appointment Payment Link*\n\n` +
      `Dear *${data.patientName}*,\n` +
      `Your appointment booking has been initiated:\n\n` +
      `👨‍⚕️ *Doctor:* ${data.doctorName} (${data.specialization})\n` +
      `📅 *Date:* ${moment(data.date).format('DD MMM YYYY')}\n` +
      `⏰ *Time Slot:* ${data.timeSlot}\n` +
      `💰 *Total Amount Payable:* ₹${Number(data.amount).toFixed(2)}\n\n` +
      `👉 *Click here to Pay securely via UPI / QR / Card:* \n${data.url}\n\n` +
      `_Please complete payment to confirm your booking._`;

    const cleanMobile = String(data.patientMobile || '').replace(/[^0-9]/g, '');
    const phoneParam = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const waUrl = phoneParam
      ? `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, '_blank');
  };

  const handleNativeShare = async (data) => {
    if (!data || !data.url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Appointment with ${data.doctorName}`,
          text: `Payment link for Doctor Appointment with ${data.doctorName} (₹${Number(data.amount).toFixed(2)}):`,
          url: data.url,
        });
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Share failed:', e);
        }
      }
    } else {
      handleCopyLink(data.url);
    }
  };

  const handleResetToNewBooking = () => {
    setBookedAppointment(null);
    setSelectedDoctor(null);
    setSelectedSlot('');
    setPaymentLinkModalData(null);
    setShowPaymentLinkModal(false);
    setPaymentMethod('wallet');
    setFormData({
      patientName: '',
      fatherName: '',
      mobileNumber: '',
      email: '',
      dob: '',
      age: '',
      gender: 'Male',
      pincode: '',
      city: '',
      state: '',
      symptoms: '',
      address: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (bookedAppointment) {
      setBookedAppointment(null);
      setSelectedDoctor(null);
    } else if (selectedDoctor) {
      setSelectedDoctor(null);
    } else {
      navigate('/');
    }
  };

  return (
    <div style={pageContainerStyle}>
      {/* Top Header */}
      <div style={headerStyle}>
        <button onClick={handleBack} style={backBtnStyle} title="Go Back">
          <i className="fa-solid fa-arrow-left" style={{ fontSize: '18px', color: '#b4a383' }}></i>
        </button>
        <h1 style={titleStyle}>
          {bookedAppointment
            ? 'Appointment Receipt'
            : selectedDoctor
              ? 'Patient & Appointment Details'
              : 'Doctor Appointment'}
        </h1>
        <div style={{ width: 36 }}></div>
      </div>

      <div style={contentStyle}>
        {bookedAppointment ? (
          /* =========================================================================
             STEP 3: APPOINTMENT CONFIRMATION & RECEIPT (STAYS ON SAME PAGE)
             ========================================================================= */
          <div style={cardSectionStyle}>
            <div style={{ textAlign: 'center', padding: '16px 0 10px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  margin: '0 auto 12px',
                  boxShadow: '0 0 0 8px #f0fdf4',
                }}
              >
                <i className="fa-solid fa-check"></i>
              </div>
              <h2 style={{ fontSize: '22px', color: '#166534', margin: '0 0 6px', fontWeight: '800' }}>
                Appointment Confirmed!
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                Your appointment has been successfully booked with <strong>{bookedAppointment.doctorName}</strong>.
              </p>
            </div>

            {/* Highlighted Appointment Number Banner */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '2px dashed #3b82f6',
                borderRadius: '12px',
                padding: '18px',
                margin: '18px 0',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  color: '#1e40af',
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  letterSpacing: '1px',
                }}
              >
                Appointment Number / Index
              </span>
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: '900',
                  color: '#1d4ed8',
                  marginTop: '4px',
                  letterSpacing: '1px',
                }}
              >
                {bookedAppointment.appointmentNumber}
              </div>
              {bookedAppointment.appointmentIndex !== null &&
                String(bookedAppointment.appointmentIndex) !== String(bookedAppointment.appointmentNumber) && (
                  <div style={{ marginTop: '8px' }}>
                    <span
                      style={{
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'inline-block',
                      }}
                    >
                      <i className="fa-solid fa-ticket" style={{ marginRight: '6px' }}></i>
                      Appointment Index (Token): #{bookedAppointment.appointmentIndex}
                    </span>
                  </div>
                )}
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', display: 'inline-block' }}>
                Please provide this appointment number at the clinic counter.
              </span>
            </div>

            {/* Grid of Details: Doctor & Schedule */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                marginBottom: '18px',
              }}
            >
              {/* Doctor Details */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: '#385FBF', fontWeight: '700' }}>
                  <i className="fa-solid fa-user-doctor" style={{ marginRight: '8px' }}></i> Doctor Details
                </h4>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Doctor:</strong> {bookedAppointment.doctorName}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                  <strong>Specialization:</strong> {bookedAppointment.specialization}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                  <strong>Clinic / Center:</strong> {bookedAppointment.hospital || 'Care Clinic'}
                </p>
              </div>

              {/* Schedule Details */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: '#385FBF', fontWeight: '700' }}>
                  <i className="fa-regular fa-calendar-check" style={{ marginRight: '8px' }}></i> Schedule & Slot
                </h4>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Date:</strong> {moment(bookedAppointment.date).format('dddd, Do MMMM YYYY')}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Time Slot:</strong>{' '}
                  <span style={{ color: '#16a34a', fontWeight: '700' }}>{bookedAppointment.timeSlot}</span>
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                  <strong>Booked On:</strong> {bookedAppointment.bookingTime}
                </p>
              </div>
            </div>

            {/* Patient & Payment Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              {/* Patient Info */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: '#385FBF', fontWeight: '700' }}>
                  <i className="fa-solid fa-hospital-user" style={{ marginRight: '8px' }}></i> Patient Details
                </h4>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Name:</strong> {bookedAppointment.patientName} ({bookedAppointment.age} Yrs,{' '}
                  {bookedAppointment.gender})
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Mobile:</strong> +91 {bookedAppointment.mobileNumber}
                </p>
                {bookedAppointment.fatherName && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                    <strong>Guardian:</strong> {bookedAppointment.fatherName}
                  </p>
                )}
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                  <strong>Address:</strong> {bookedAppointment.address}, {bookedAppointment.city} (
                  {bookedAppointment.pincode})
                </p>
              </div>

              {/* Payment Info */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: '#385FBF', fontWeight: '700' }}>
                  <i className="fa-solid fa-receipt" style={{ marginRight: '8px' }}></i> Payment Summary
                </h4>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Fee Paid:</strong>{' '}
                  <span style={{ fontWeight: '800', color: '#16a34a' }}>{bookedAppointment.doctorFee}</span>
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Payment Status:</strong>{' '}
                  <span style={{ color: '#16a34a', fontWeight: '700' }}>PAID (Verified)</span>
                </p>
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b', wordBreak: 'break-all' }}>
                  <strong>Payment ID:</strong> {bookedAppointment.paymentId}
                </p>
              </div>
            </div>

            {/* Action Buttons: Book Another or Print */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleResetToNewBooking}
                style={{
                  ...bookBtnStyle,
                  maxWidth: '260px',
                  backgroundColor: '#385FBF',
                  color: '#ffffff',
                }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: '8px' }}></i>
                Book Another Appointment
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  ...bookBtnStyle,
                  maxWidth: '220px',
                  backgroundColor: '#f1f5f9',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                }}
              >
                <i className="fa-solid fa-print" style={{ marginRight: '8px' }}></i>
                Print Receipt
              </button>
            </div>
          </div>
        ) : !selectedDoctor ? (
          /* =========================================================================
             STEP 1: DOCTOR SEARCH & SELECTION (Shown when NO doctor is selected)
             ========================================================================= */
          <div style={cardSectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={stepBadgeStyle}>Step 1</span>
              <h2 style={sectionTitleStyle}>Search & Select Doctor</h2>
            </div>
            <p style={subTextStyle}>
              Search a doctor directly by <strong>Doctor ID</strong> or find available doctors by <strong>Pincode / Block</strong>.
            </p>

            {/* Mode Switcher Tabs */}
            <div style={tabContainerStyle}>
              <button
                type="button"
                onClick={() => {
                  setSearchMode('pincode');
                  setHasSearched(false);
                }}
                style={{
                  ...tabButtonStyle,
                  backgroundColor: searchMode === 'pincode' ? '#385FBF' : '#f1f5f9',
                  color: searchMode === 'pincode' ? '#ffffff' : '#475569',
                }}
              >
                <i className="fa-solid fa-location-dot" style={{ marginRight: '8px' }}></i>
                Search by Pincode
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchMode('id');
                  setHasSearched(false);
                }}
                style={{
                  ...tabButtonStyle,
                  backgroundColor: searchMode === 'id' ? '#385FBF' : '#f1f5f9',
                  color: searchMode === 'id' ? '#ffffff' : '#475569',
                }}
              >
                <i className="fa-solid fa-id-card" style={{ marginRight: '8px' }}></i>
                Search by Doctor ID
              </button>
            </div>

            {/* Search by Pincode Form */}
            {searchMode === 'pincode' && (
              <form onSubmit={handleSearchByPincode} style={{ marginTop: '16px' }}>
                <label style={labelStyle}>
                  Area Pincode <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={searchRowStyle}>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit Pincode (e.g. 480661)"
                    value={pincodeInput}
                    onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ''))}
                    style={inputStyle}
                  />
                  <button type="submit" style={searchBtnStyle}>
                    <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '6px' }}></i>
                    Find Doctors
                  </button>
                </div>
                <small style={{ color: '#64748b', fontSize: '12px' }}>
                  Enter postal pincode to see available doctors in your block.
                </small>

                {/* Block & Doctors List Result */}
                {hasSearched && (
                  <div style={{ marginTop: '20px' }}>
                    {detectedBlock && (
                      <div style={blockInfoBoxStyle}>
                        <i className="fa-solid fa-map-pin" style={{ color: '#385FBF', marginRight: '8px', fontSize: '16px' }}></i>
                        <span>
                          Block: <strong>{detectedBlock}</strong> (Pincode: {pincodeInput})
                        </span>
                      </div>
                    )}

                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', margin: '14px 0 10px' }}>
                      Available Doctors ({pincodeDoctors.length})
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {pincodeDoctors.map((doc, idx) => {
                        const docId = doc.secondaryId || doc.mongoid || `doc-${idx}`;
                        const docName = doc.doctor_name || doc.name;
                        return (
                          <div key={doc.mongoid || docId} style={doctorResultCardStyle}>
                            <div style={doctorAvatarStyle}>
                              <i className="fa-solid fa-user-doctor" style={{ fontSize: '24px', color: '#385FBF' }}></i>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={doctorNameStyle}>{docName}</h4>
                                <span style={idTagStyle}>{doc.secondaryId ? `ID: ${doc.secondaryId}` : `ID: ${doc.mongoid?.slice(-6).toUpperCase()}`}</span>
                              </div>
                              <p style={doctorSpecialtyStyle}>{doc.specialization || doc.specialty || 'Specialist'}</p>
                              <p style={doctorMetaStyle}>
                                <i className="fa-solid fa-location-dot" style={{ marginRight: '5px', color: '#94a3b8' }}></i>
                                {detectedBlock || 'District Center'}
                              </p>
                              <p style={doctorMetaStyle}>
                                <i className="fa-solid fa-money-bill-wave" style={{ marginRight: '5px', color: '#16a34a' }}></i>
                                Fee: <strong>₹{doc.appointmentfee || 250}</strong>
                                {doc.appointmentdatelimit ? ` • Window: ${doc.appointmentdatelimit} Days` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectDoctor(doc)}
                              style={selectBtnStyle}
                            >
                              Select Doctor
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* Search by Doctor ID Form */}
            {searchMode === 'id' && (
              <form onSubmit={handleSearchById} style={{ marginTop: '16px' }}>
                <label style={labelStyle}>
                  Doctor ID <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={searchRowStyle}>
                  <input
                    type="text"
                    placeholder="Enter Doctor ID (e.g. A1001)"
                    value={doctorIdInput}
                    onChange={(e) => setDoctorIdInput(e.target.value)}
                    style={inputStyle}
                  />
                  <button type="submit" style={searchBtnStyle}>
                    <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '6px' }}></i>
                    Search
                  </button>
                </div>
                <small style={{ color: '#64748b', fontSize: '12px' }}>
                  Search by specific Doctor ID or Registration Code.
                </small>

                {/* Doctor Card Result */}
                {hasSearched && searchedDoctor && (
                  <div style={doctorResultCardStyle}>
                    <div style={doctorAvatarStyle}>
                      <i className="fa-solid fa-user-doctor" style={{ fontSize: '26px', color: '#385FBF' }}></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={doctorNameStyle}>{searchedDoctor.doctor_name || searchedDoctor.name}</h3>
                        <span style={idTagStyle}>{searchedDoctor.secondaryId ? `ID: ${searchedDoctor.secondaryId}` : searchedDoctor.id}</span>
                      </div>
                      <p style={doctorSpecialtyStyle}>{searchedDoctor.specialization || searchedDoctor.specialty || 'Specialist'}</p>
                      <p style={doctorMetaStyle}>
                        <i className="fa-solid fa-money-bill-wave" style={{ marginRight: '5px', color: '#16a34a' }}></i>
                        Fee: <strong>₹{searchedDoctor.appointmentfee || 250}</strong>
                        {searchedDoctor.appointmentdatelimit ? ` • Window: ${searchedDoctor.appointmentdatelimit} Days` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectDoctor(searchedDoctor)}
                      style={selectBtnStyle}
                    >
                      Select Doctor
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        ) : (
          /* =========================================================================
             STEP 2: DOCTOR SELECTED & PATIENT DETAILS FORM (Only this is shown!)
             ========================================================================= */
          <>
            {/* Active Payment Link Alert Banner */}
            {paymentLinkModalData && !showPaymentLinkModal && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    <i className="fa-solid fa-qrcode"></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
                      Active Payment Link for {paymentLinkModalData.patientName} (₹{Number(paymentLinkModalData.amount || 0).toFixed(2)})
                    </div>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>
                      Doctor: {paymentLinkModalData.doctorName} • {moment(paymentLinkModalData.date).format('DD MMM')}, {paymentLinkModalData.timeSlot}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentLinkModal(true)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <i className="fa-solid fa-eye"></i> View / Share
                </button>
              </div>
            )}

            {/* Selected Doctor Summary Banner */}
            <div style={selectedDoctorBannerStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={selectedIconBadge}>
                  <i className="fa-solid fa-user-check" style={{ color: '#ffffff', fontSize: '18px' }}></i>
                </div>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#15803d', fontWeight: '700' }}>
                    ✓ Selected Doctor
                  </span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#14532d' }}>
                    {selectedDoctor.doctor_name || selectedDoctor.name}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#166534' }}>
                    {selectedDoctor.specialization || selectedDoctor.specialty} • Consultation Fee: <strong>{selectedDoctor.fee}</strong>
                    {selectedDoctor.secondaryId ? ` (ID: ${selectedDoctor.secondaryId})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                style={changeDoctorBtnStyle}
              >
                <i className="fa-solid fa-rotate-left" style={{ marginRight: '5px' }}></i> Change
              </button>
            </div>

            {/* Appointment Date & Time Slots Selection Card */}
            <div style={cardSectionStyle}>
              <div style={sectionHeaderStyle}>
                <span style={stepBadgeStyle}>Step 1</span>
                <h2 style={sectionTitleStyle}>Select Date & Available Time Slot</h2>
              </div>
              <p style={subTextStyle}>Choose your preferred consultation date and available appointment slot.</p>

              {/* Available Dates Horizontal Chips */}
              <div style={{ marginTop: '14px' }}>
                <label style={labelStyle}>
                  Select Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={dateChipsContainerStyle}>
                  {availableDates.map((dateStr) => {
                    const isSelected = selectedDate === dateStr;
                    const dateObj = moment(dateStr);
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => handleDateSelection(dateStr)}
                        style={{
                          ...dateChipStyle,
                          backgroundColor: isSelected ? '#385FBF' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#1e293b',
                          borderColor: isSelected ? '#385FBF' : '#cbd5e1',
                          boxShadow: isSelected ? '0 4px 10px rgba(56, 95, 191, 0.3)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: '600', opacity: isSelected ? 0.9 : 0.6, textTransform: 'uppercase' }}>
                          {dateObj.format('ddd')}
                        </span>
                        <span style={{ fontSize: '15px', fontWeight: '700', margin: '2px 0' }}>
                          {dateObj.format('DD')}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '500' }}>
                          {dateObj.format('MMM')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Available Slots Grid */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Available Time Slots for {moment(selectedDate).format('Do MMMM')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {loadingSlots && <small style={{ color: '#385FBF', fontSize: '12px' }}>Loading slots...</small>}
                </div>

                <div style={slotsGridStyle}>
                  {availableSlots.length > 0 ? (
                    availableSlots.map((slot, index) => {
                      const isPassed = isSlotPassed(slot.title || slot.id, selectedDate);
                      const isDisabled = !slot.enabled || isPassed;
                      const isSelected = selectedSlot === slot.id && !isDisabled;
                      return (
                        <button
                          key={slot.id || index}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedSlot(slot.id)}
                          title={isPassed ? 'Slot has passed for today' : isDisabled ? 'Slot unavailable' : 'Select slot'}
                          style={{
                            ...slotChipStyle,
                            backgroundColor: isSelected ? '#385FBF' : isDisabled ? '#f1f5f9' : '#ffffff',
                            color: isSelected ? '#ffffff' : isDisabled ? '#94a3b8' : '#1e293b',
                            borderColor: isSelected ? '#385FBF' : '#cbd5e1',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.5 : 1,
                            boxShadow: isSelected ? '0 3px 8px rgba(56, 95, 191, 0.25)' : 'none',
                          }}
                        >
                          <i className="fa-regular fa-clock" style={{ marginRight: '6px', fontSize: '12px' }}></i>
                          <span style={{ textDecoration: isPassed ? 'line-through' : 'none' }}>
                            {slot.title || slot.id}
                          </span>
                          {isPassed && (
                            <span style={{ fontSize: '10px', marginLeft: '6px', color: '#ef4444', fontWeight: '700' }}>
                              (Closed)
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '13px', gridColumn: '1 / -1', margin: 0 }}>
                      No slots available for this date. Please select another date.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Patient Information Form Card */}
            <div id="patient-booking-form" style={cardSectionStyle}>
              <div style={sectionHeaderStyle}>
                <span style={stepBadgeStyle}>Step 2</span>
                <h2 style={sectionTitleStyle}>Patient Information</h2>
              </div>
              <p style={subTextStyle}>Enter patient details for registration and appointment generation.</p>

              <form onSubmit={handleOpenReview} style={{ marginTop: '16px' }}>
                <div style={formGridStyle}>
                  {/* Full Name */}
                  <div>
                    <label style={labelStyle}>
                      Patient Full Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="patientName"
                      placeholder="e.g. Rahul Sharma"
                      value={formData.patientName}
                      onChange={handleInputChange}
                      style={inputStyle}
                      required
                    />
                  </div>

                  {/* Father's / Guardian Name */}
                  <div>
                    <label style={labelStyle}>
                      Father / Guardian Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="fatherName"
                      placeholder="e.g. Suresh Sharma"
                      value={formData.fatherName}
                      onChange={handleInputChange}
                      style={inputStyle}
                      required
                    />
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label style={labelStyle}>
                      Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      name="mobileNumber"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={formData.mobileNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          mobileNumber: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      style={inputStyle}
                      required
                    />
                  </div>

                  {/* DOB & Auto-Calculated Age */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>
                        Date of Birth <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        max={moment().format('YYYY-MM-DD')}
                        value={formData.dob}
                        onChange={handleDobChange}
                        style={inputStyle}
                        required
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Age</label>
                      <input
                        type="text"
                        value={formData.age ? `${formData.age} Yrs` : ''}
                        readOnly
                        placeholder="Auto"
                        style={{
                          ...inputStyle,
                          backgroundColor: '#f1f5f9',
                          fontWeight: '600',
                          color: '#334155',
                          textAlign: 'center',
                        }}
                      />
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <label style={labelStyle}>
                      Gender <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      style={inputStyle}
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Pincode with Auto-Fetch */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>
                        Pincode <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      {isFetchingPin && <small style={{ color: '#385FBF', fontSize: '11px' }}>Fetching city/state...</small>}
                    </div>
                    <input
                      type="text"
                      name="pincode"
                      maxLength={6}
                      placeholder="6-digit Pincode"
                      value={formData.pincode}
                      onChange={handlePatientPinCodeChange}
                      style={inputStyle}
                      required
                    />
                  </div>

                  {/* City (Auto-filled from pincode) */}
                  <div>
                    <label style={labelStyle}>
                      City / District <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      placeholder="Auto-filled from pincode"
                      value={formData.city}
                      onChange={handleInputChange}
                      style={inputStyle}
                      required
                    />
                  </div>

                  {/* State (Auto-filled from pincode) */}
                  <div>
                    <label style={labelStyle}>
                      State <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="state"
                      placeholder="Auto-filled from pincode"
                      value={formData.state}
                      onChange={handleInputChange}
                      style={inputStyle}
                      required
                    />
                  </div>

                  {/* Email (Optional) */}
                  <div>
                    <label style={labelStyle}>
                      Email Address <span style={optionalBadgeStyle}>Optional</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="e.g. name@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      style={inputStyle}
                    />
                  </div>

                  {/* Symptoms (Optional) */}
                  <div>
                    <label style={labelStyle}>
                      Symptoms / Reason for Visit <span style={optionalBadgeStyle}>Optional</span>
                    </label>
                    <input
                      type="text"
                      name="symptoms"
                      placeholder="e.g. Fever, Consultation"
                      value={formData.symptoms}
                      onChange={handleInputChange}
                      style={inputStyle}
                    />
                  </div>

                  {/* Full Address (Optional) */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>
                      Full Residential Address <span style={optionalBadgeStyle}>Optional</span>
                    </label>
                    <textarea
                      name="address"
                      rows={2}
                      placeholder="House No, Colony / Street, Village / Area (Optional)"
                      value={formData.address}
                      onChange={handleInputChange}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* Consultation Fee & Agent Wallet Balance Summary */}
                {(() => {
                  const numericFee = getNumericFee();
                  const isSufficient = walletBalance !== null && walletBalance >= numericFee;
                  return (
                    <div style={{
                      marginTop: '20px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                            Consultation Fee
                          </span>
                          <h4 style={{ margin: 0, fontSize: '20px', color: '#1e293b', fontWeight: '800' }}>
                            {selectedDoctor.fee}
                          </h4>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <i className="fa-solid fa-wallet" style={{ color: '#385FBF' }}></i>
                            Agent Wallet Balance:
                          </span>
                          <div style={{
                            fontSize: '17px',
                            fontWeight: '800',
                            color: isSufficient ? '#16a34a' : '#dc2626'
                          }}>
                            {walletLoading ? 'Checking...' : `₹${Number(walletBalance || 0).toFixed(2)}`}
                          </div>
                        </div>
                      </div>

                      {/* Insufficient Warning Alert if balance is low */}
                      {!isSufficient && walletBalance !== null && (
                        <div style={{
                          marginTop: '12px',
                          padding: '10px 12px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#b91c1c',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <i className="fa-solid fa-triangle-exclamation"></i>
                          Your wallet balance is less than ₹{numericFee.toFixed(2)}. Please recharge your wallet to book this appointment.
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ marginTop: '18px' }}>
                  <button type="submit" style={bookBtnStyle}>
                    <i className="fa-solid fa-file-invoice" style={{ marginRight: '8px', fontSize: '17px' }}></i>
                    Review & Book Appointment ({selectedDoctor.fee})
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* =========================================================================
          PATIENT APPOINTMENT REVIEW MODAL
          ========================================================================= */}
      {showReviewModal && selectedDoctor && (
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
          zIndex: 9999,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
                  <i className="fa-solid fa-file-invoice"></i>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                    Review Appointment Details
                  </h2>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>
                    Please verify patient information before proceeding to payment
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
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
            <div style={{ padding: '20px 24px' }}>
              {/* Doctor & Schedule Card */}
              <div style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: '700' }}>Doctor & Schedule</span>
                    <h3 style={{ margin: '2px 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#1e3a8a' }}>
                      {selectedDoctor.name}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '500' }}>
                      {selectedDoctor.specialization || selectedDoctor.specialty || 'Consultant'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      backgroundColor: '#385FBF',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700'
                    }}>
                      Fee: {selectedDoctor.fee}
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: '#dbeafe', margin: '10px 0' }}></div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#1e40af' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-calendar-day"></i>
                    <strong>{moment(selectedDate).format('Do MMMM YYYY')}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-regular fa-clock"></i>
                    <strong>{selectedSlot}</strong>
                  </div>
                </div>
              </div>

              {/* Patient Details Grid */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#385FBF',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <i className="fa-solid fa-user"></i> Patient Details
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Patient Name: </span>
                    <strong style={{ color: '#1e293b' }}>{formData.patientName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Father / Guardian: </span>
                    <strong style={{ color: '#1e293b' }}>{formData.fatherName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Mobile: </span>
                    <strong style={{ color: '#1e293b' }}>+91 {formData.mobileNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Age / Gender: </span>
                    <strong style={{ color: '#1e293b' }}>{formData.age ? `${formData.age} Yrs` : 'N/A'}, {formData.gender}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Date of Birth: </span>
                    <strong style={{ color: '#1e293b' }}>{formData.dob ? moment(formData.dob).format('DD MMM YYYY') : 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Email: </span>
                    <strong style={{ color: '#1e293b' }}>{formData.email || 'Not Provided'}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#64748b' }}>Location: </span>
                    <strong style={{ color: '#1e293b' }}>{[formData.city, formData.state].filter(Boolean).join(', ')} - {formData.pincode}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#64748b' }}>Residential Address: </span>
                    <strong style={{ color: '#1e293b' }}>{formData.address.trim() || 'Not Provided (Optional)'}</strong>
                  </div>
                  {formData.symptoms && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#64748b' }}>Symptoms: </span>
                      <strong style={{ color: '#1e293b' }}>{formData.symptoms}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* =========================================================
                  PAYMENT METHOD SELECTOR
                  ========================================================= */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px'
                }}>
                  Payment Option
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                  {/* Option 1: Agent Wallet */}
                  <div
                    onClick={() => setPaymentMethod('wallet')}
                    style={{
                      border: `2px solid ${paymentMethod === 'wallet' ? '#385FBF' : '#e2e8f0'}`,
                      backgroundColor: paymentMethod === 'wallet' ? '#eff6ff' : '#ffffff',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease-in-out',
                      boxShadow: paymentMethod === 'wallet' ? '0 2px 8px rgba(56, 95, 191, 0.12)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: paymentMethod === 'wallet' ? '#385FBF' : '#f1f5f9',
                        color: paymentMethod === 'wallet' ? '#ffffff' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                      }}>
                        <i className="fa-solid fa-wallet"></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: paymentMethod === 'wallet' ? '#1e3a8a' : '#1e293b' }}>
                          Agent Saving Wallet
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Instant wallet deduction
                        </div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'wallet'}
                      onChange={() => setPaymentMethod('wallet')}
                      style={{ width: '18px', height: '18px', accentColor: '#385FBF', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Option 2: UPI / Online Payment Link */}
                  <div
                    onClick={() => setPaymentMethod('upi')}
                    style={{
                      border: `2px solid ${paymentMethod === 'upi' ? '#16a34a' : '#e2e8f0'}`,
                      backgroundColor: paymentMethod === 'upi' ? '#f0fdf4' : '#ffffff',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease-in-out',
                      boxShadow: paymentMethod === 'upi' ? '0 2px 8px rgba(22, 163, 74, 0.15)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: paymentMethod === 'upi' ? '#16a34a' : '#f1f5f9',
                        color: paymentMethod === 'upi' ? '#ffffff' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                      }}>
                        <i className="fa-solid fa-qrcode"></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: paymentMethod === 'upi' ? '#15803d' : '#1e293b' }}>
                          UPI / Online Payment
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Generate Link & QR Code
                        </div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'upi'}
                      onChange={() => setPaymentMethod('upi')}
                      style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Agent Wallet Payment Details */}
              {paymentMethod === 'wallet' && (() => {
                const numericFee = getNumericFee();
                const currentMarkup = Number(markupAmount || 0);
                const totalPayable = numericFee + currentMarkup;
                const isSufficient = walletBalance !== null && walletBalance >= totalPayable;
                return (
                  <div style={{
                    backgroundColor: isSufficient ? '#f0fdf4' : '#fef2f2',
                    border: `1.5px solid ${isSufficient ? '#86efac' : '#fca5a5'}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: isSufficient ? '#dcfce7' : '#fee2e2',
                          color: isSufficient ? '#16a34a' : '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px'
                        }}>
                          <i className="fa-solid fa-wallet"></i>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                            Agent Wallet Payment
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {walletNumber ? `Wallet: ${walletNumber}` : 'Saving Wallet'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={fetchAgentWallet}
                        title="Refresh Balance"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          color: '#475569',
                          fontSize: '12px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <i className={`fa-solid fa-rotate-right ${walletLoading ? 'fa-spin' : ''}`}></i>
                        <span style={{ fontSize: '11px', fontWeight: '600' }}>Refresh</span>
                      </button>
                    </div>

                    {/* Fee, Markup & Total Payable Breakdown */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 14px',
                      marginBottom: '10px',
                      fontSize: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#475569' }}>
                        <span>Doctor Consultation Fee:</span>
                        <strong>₹{numericFee.toFixed(2)}</strong>
                      </div>
                      {currentMarkup > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#2563eb' }}>
                          <span>Channel Partner Markup:</span>
                          <strong>+ ₹{currentMarkup.toFixed(2)}</strong>
                        </div>
                      )}
                      <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '6px 0' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1e3a8a', fontWeight: '700' }}>
                        <span>Total Payable:</span>
                        <span>₹{totalPayable.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      marginBottom: '10px'
                    }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                          Available Balance
                        </span>
                        <div style={{
                          fontSize: '19px',
                          fontWeight: '800',
                          color: isSufficient ? '#16a34a' : '#dc2626'
                        }}>
                          {walletLoading ? 'Checking...' : `₹${Number(walletBalance || 0).toFixed(2)}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                          Total Payable
                        </span>
                        <div style={{ fontSize: '19px', fontWeight: '800', color: '#1e3a8a' }}>
                          ₹{totalPayable.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Status Alert Note (only shown if insufficient balance) */}
                    {!isSufficient && (
                      <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-circle-exclamation"></i>
                        Insufficient Wallet Balance! Required ₹{totalPayable.toFixed(2)}, Available ₹{Number(walletBalance || 0).toFixed(2)}. Aap UPI Payment option select karke payment link create kar sakte hain.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SECTION: UPI / Online Payment Link Details */}
              {paymentMethod === 'upi' && (() => {
                const numericFee = getNumericFee();
                const currentMarkup = Number(markupAmount || 0);
                const totalPayable = numericFee + currentMarkup;
                return (
                  <div style={{
                    backgroundColor: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '10px'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#dcfce7',
                        color: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px'
                      }}>
                        <i className="fa-solid fa-qrcode"></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
                          UPI & Online Payment Gateway
                        </div>
                        <div style={{ fontSize: '11px', color: '#15803d' }}>
                          Direct payment link & QR generator (No wallet deduction)
                        </div>
                      </div>
                    </div>

                    {/* Fee, Markup & Total Payable Breakdown */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      padding: '10px 14px',
                      marginBottom: '10px',
                      fontSize: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#475569' }}>
                        <span>Doctor Consultation Fee:</span>
                        <strong>₹{numericFee.toFixed(2)}</strong>
                      </div>
                      {currentMarkup > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#2563eb' }}>
                          <span>Channel Partner Markup:</span>
                          <strong>+ ₹{currentMarkup.toFixed(2)}</strong>
                        </div>
                      )}
                      <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '6px 0' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#15803d', fontWeight: '700' }}>
                        <span>Total Payable:</span>
                        <span>₹{totalPayable.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Information Note */}
                    <div style={{
                      fontSize: '12px',
                      color: '#166534',
                      backgroundColor: '#dcfce7',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      lineHeight: '1.4'
                    }}>
                      <div style={{ fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-circle-check"></i>
                        UPI Link & QR Code Banega
                      </div>
                      Payment link create hone ke baad aap ise patient ke WhatsApp par share kar sakte hain ya scan karwa kar kisi bhi UPI app (GPay, PhonePe, Paytm, BHIM) se payment karwa sakte hain.
                    </div>
                  </div>
                );
              })()}

              {/* Modal Footer Actions */}
              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  Edit Details
                </button>

                {(() => {
                  const numericFee = getNumericFee();
                  const currentMarkup = Number(markupAmount || 0);
                  const totalPayable = numericFee + currentMarkup;
                  const isSufficient = walletBalance !== null && walletBalance >= totalPayable;

                  if (paymentMethod === 'wallet') {
                    return (
                      <button
                        type="button"
                        disabled={!isSufficient || walletLoading}
                        onClick={executeBookingAndPayment}
                        style={{
                          padding: '10px 22px',
                          backgroundColor: isSufficient ? '#385FBF' : '#94a3b8',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '14px',
                          cursor: isSufficient ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: isSufficient ? '0 4px 10px rgba(56, 95, 191, 0.3)' : 'none',
                          opacity: isSufficient ? 1 : 0.7,
                        }}
                      >
                        <i className={`fa-solid ${isSufficient ? 'fa-calendar-check' : 'fa-ban'}`}></i>
                        {isSufficient
                          ? `Pay ₹${totalPayable.toFixed(2)} via Wallet`
                          : `Insufficient Balance (₹${Number(walletBalance || 0).toFixed(2)})`}
                      </button>
                    );
                  }

                  // UPI / Online Payment Link button
                  return (
                    <button
                      type="button"
                      disabled={isCreatingPaymentLink}
                      onClick={handleCreatePaymentLink}
                      style={{
                        padding: '10px 22px',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '14px',
                        cursor: isCreatingPaymentLink ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                        opacity: isCreatingPaymentLink ? 0.7 : 1,
                      }}
                    >
                      <i className={`fa-solid ${isCreatingPaymentLink ? 'fa-spinner fa-spin' : 'fa-qrcode'}`}></i>
                      {isCreatingPaymentLink
                        ? 'Generating Link...'
                        : `Generate UPI Link (₹${totalPayable.toFixed(2)})`}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          UPI / ONLINE PAYMENT LINK DISPLAY MODAL
          ========================================================================= */}
      {showPaymentLinkModal && paymentLinkModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
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
              background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
              color: '#ffffff',
              borderRadius: '15px 15px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  <i className="fa-solid fa-qrcode"></i>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                    UPI / Online Payment Link
                  </h2>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>
                    Appointment initiated • Scan QR or share link to pay
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPaymentLinkModal(false)}
                title="Close"
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
                  backgroundColor: 'rgba(255,255,255,0.15)'
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px' }}>
              {/* Appointment Details Summary */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Doctor</span>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                      {paymentLinkModalData.doctorName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#385FBF', fontWeight: '500' }}>
                      {paymentLinkModalData.specialization}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Amount</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a' }}>
                      ₹{Number(paymentLinkModalData.amount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 0' }}></div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Patient: </span>
                    <strong>{paymentLinkModalData.patientName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Mobile: </span>
                    <strong>+91 {paymentLinkModalData.patientMobile}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Schedule: </span>
                    <strong>{moment(paymentLinkModalData.date).format('DD MMM YYYY')}, {paymentLinkModalData.timeSlot}</strong>
                  </div>
                  {paymentLinkModalData.paymentLinkId && (
                    <div>
                      <span style={{ color: '#94a3b8' }}>Link ID: </span>
                      <code style={{ fontSize: '11px', color: '#385FBF' }}>{paymentLinkModalData.paymentLinkId}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code Section */}
              {paymentLinkModalData.url && (
                <div style={{
                  textAlign: 'center',
                  backgroundColor: '#f0fdf4',
                  border: '1.5px dashed #86efac',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534', marginBottom: '10px' }}>
                    <i className="fa-solid fa-qrcode" style={{ marginRight: '6px' }}></i>
                    Scan with any UPI App to Pay
                  </div>
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: '#ffffff',
                    padding: '8px',
                    borderRadius: '10px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #cbd5e1'
                  }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=4&data=${encodeURIComponent(paymentLinkModalData.url)}`}
                      alt="Payment Link QR Code"
                      style={{ width: '160px', height: '160px', display: 'block' }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px', fontWeight: '500' }}>
                    Supports PhonePe • Google Pay • Paytm • BHIM & all UPI Apps
                  </div>
                </div>
              )}

              {/* Payment Link Box with Copy Button */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Payment Link URL
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={paymentLinkModalData.url || ''}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      backgroundColor: '#f8fafc',
                      color: '#1e293b',
                      outline: 'none',
                      fontFamily: 'monospace'
                    }}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(paymentLinkModalData.url)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: copiedLink ? '#16a34a' : '#385FBF',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background-color 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-copy'}`}></i>
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Sharing & Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {/* WhatsApp Share Button */}
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(paymentLinkModalData)}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    backgroundColor: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)',
                    transition: 'opacity 0.2s'
                  }}
                >
                  <i className="fa-brands fa-whatsapp" style={{ fontSize: '20px' }}></i>
                  Share via WhatsApp (+91 {paymentLinkModalData.patientMobile})
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Open Link & Pay in new tab */}
                  <button
                    type="button"
                    onClick={() => window.open(paymentLinkModalData.url, '_blank')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      backgroundColor: '#385FBF',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    Open & Pay Now
                  </button>

                  {/* Native Share / More Apps */}
                  <button
                    type="button"
                    onClick={() => handleNativeShare(paymentLinkModalData)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-share-nodes"></i>
                    Share via Apps
                  </button>
                </div>
              </div>

              {/* Information Note */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="fa-solid fa-circle-info" style={{ color: '#385FBF', fontSize: '14px' }}></i>
                <span>Payment link is active. The patient can complete payment at their convenience.</span>
              </div>

              {/* Modal Footer / Close Button */}
              <div style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid #e2e8f0',
                textAlign: 'center'
              }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentLinkModal(false)}
                  style={{
                    width: '100%',
                    padding: '11px',
                    backgroundColor: '#e2e8f0',
                    color: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrAppoint;

/**
 * =========================================================================
 * 🎨 MODERN LIGHT THEME STYLES (Matching Agent Portal Aesthetic)
 * =========================================================================
 */
const pageContainerStyle = {
  backgroundColor: '#f8fafc',
  minHeight: '100vh',
  paddingBottom: '50px',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const headerStyle = {
  backgroundColor: '#ffffff',
  height: '56px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};

const backBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
};

const titleStyle = {
  fontSize: '17px',
  fontWeight: '700',
  color: '#b4a383',
  margin: 0,
  textAlign: 'center',
};

const contentStyle = {
  maxWidth: '750px',
  margin: '18px auto',
  padding: '0 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const cardSectionStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  border: '1px solid #e2e8f0',
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '6px',
};

const stepBadgeStyle = {
  backgroundColor: '#385FBF',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: '700',
  padding: '2px 8px',
  borderRadius: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const sectionTitleStyle = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#1e293b',
  margin: 0,
};

const subTextStyle = {
  fontSize: '13px',
  color: '#64748b',
  margin: '0 0 12px 0',
  lineHeight: '1.4',
};

const tabContainerStyle = {
  display: 'flex',
  gap: '10px',
  marginTop: '8px',
};

const tabButtonStyle = {
  flex: 1,
  padding: '10px 14px',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#334155',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  fontSize: '14px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  transition: 'border-color 0.2s',
};

const searchRowStyle = {
  display: 'flex',
  gap: '8px',
  marginBottom: '6px',
};

const searchBtnStyle = {
  backgroundColor: '#385FBF',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 18px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
};

const doctorResultCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '14px',
  marginTop: '12px',
  flexWrap: 'wrap',
};

const doctorAvatarStyle = {
  width: '48px',
  height: '48px',
  backgroundColor: '#e0e7ff',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const doctorNameStyle = {
  fontSize: '15px',
  fontWeight: '700',
  color: '#1e293b',
  margin: 0,
};

const idTagStyle = {
  fontSize: '11px',
  backgroundColor: '#e2e8f0',
  color: '#475569',
  padding: '2px 6px',
  borderRadius: '4px',
  fontWeight: '600',
};

const doctorSpecialtyStyle = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#385FBF',
  margin: '2px 0',
};

const doctorMetaStyle = {
  fontSize: '12px',
  color: '#64748b',
  margin: '2px 0',
};

const selectBtnStyle = {
  border: 'none',
  backgroundColor: '#385FBF',
  color: '#ffffff',
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  marginLeft: 'auto',
};

const blockInfoBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '13px',
  color: '#1e40af',
};

const selectedDoctorBannerStyle = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '12px',
  padding: '14px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
};

const selectedIconBadge = {
  width: '38px',
  height: '38px',
  borderRadius: '50%',
  backgroundColor: '#16a34a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const changeDoctorBtnStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #86efac',
  color: '#15803d',
  fontSize: '12px',
  fontWeight: '600',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const dateChipsContainerStyle = {
  display: 'flex',
  gap: '10px',
  overflowX: 'auto',
  padding: '4px 0 8px',
};

const dateChipStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 14px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '68px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const slotsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
  gap: '10px',
  marginTop: '8px',
};

const slotChipStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '12px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
};

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '14px',
};

const optionalBadgeStyle = {
  fontSize: '11px',
  fontWeight: '500',
  color: '#64748b',
  backgroundColor: '#f1f5f9',
  padding: '1px 6px',
  borderRadius: '4px',
  marginLeft: '4px',
};

const bookingSummaryBoxStyle = {
  marginTop: '20px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '14px 18px',
};

const bookBtnStyle = {
  width: '100%',
  backgroundColor: '#385FBF',
  color: '#ffffff',
  border: 'none',
  padding: '14px',
  borderRadius: '10px',
  fontSize: '15px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 6px rgba(56, 95, 191, 0.25)',
  transition: 'background-color 0.2s',
};
