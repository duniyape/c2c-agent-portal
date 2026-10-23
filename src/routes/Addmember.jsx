import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import UploadFile from '../Components/UploadFile';
import moment from 'moment';
import axios from 'axios';
import { useLoader } from '../loader/LoaderContext';
import Swal from 'sweetalert2';
import statejosn from './statedistrict.json';
import { BASE_URL as localprimeBase } from '../config/api';
import { compressImage } from '../utils/imageCompressor';

const toast = {
  success: (msg) => {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: msg,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  },
  error: (msg) => {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: msg,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  },
};

const MemberApplicationForm = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (statejosn && statejosn[2]) {
      console.log(statejosn[2].districts);
    }
  }, []);

  const [tab, settab] = useState(1);
  // const [OtpShow, setOtpShow] = useState(false); // commented out: OTP flow disabled
  const [loader, setloader] = useState(false);
  const [aadharVerified, setAadharVerified] = useState(false);
  const [aadharChecking, setAadharChecking] = useState(false);
  const [aadharStatus, setAadharStatus] = useState(null); // 'ok' | 'duplicate' | null
  const [fetchingPin, setFetchingPin] = useState(false);
  const [fetchingCpin, setFetchingCpin] = useState(false);
  const [compressingStatus, setCompressingStatus] = useState({});

  const loaderCtx = useLoader();
  const showLoader = loaderCtx?.showLoader || (() => { });
  const hideLoader = loaderCtx?.hideLoader || (() => { });

  const initialFormData = {
    branchname: '',
    branch: '',
    aadhartxn: '',
    title: '',
    firstname: '',
    lastname: '',
    fathername: '',
    dob: '',
    age: '',
    gender: '',
    category: '',
    mobile: '',
    email: '',
    occupation: '',
    officeaddress: '',
    income: '',
    aadharnumber: '',
    paddress: '',
    city: '',
    state: 'Madhya Pradesh',
    district: '',
    pincode: '',
    sameaddress: false,
    caddress: '',
    ccity: '',
    cstate: 'Madhya Pradesh',
    cdistrict: '',
    cpincode: '',
    introducerid: localStorage.getItem('MID') || '',
    introducername: '',
    peroidknown: '',
    nomineetitle: '',
    nomineename: '',
    nomineerelation: '',
    nomineedob: '',
    nomineeage: '',
    nomineeaddress: '',
    gurdiantitle: '',
    gurdianname: '',
    gurdianrelation: '',
    gurdiandob: '',
    gurdianage: '',
    idproof: '',
    idproofnumber: '',
    addressproof: '',
    addressproofnumber: '',
    photo: '',
    idfront: '',
    idback: '',
    addfront: '',
    addback: '',
    membertype: '',
  };

  const [formdata, setformdata] = useState(initialFormData);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'sameAsPermanent' && checked) {
        setformdata((prev) => ({
          ...prev,
          sameaddress: !prev.sameaddress,
          caddress: prev.paddress,
          ccity: prev.city,
          cstate: prev.state,
          cdistrict: prev.district,
          cpincode: prev.pincode,
        }));
      } else {
        setformdata((prev) => ({
          ...prev,
          sameaddress: false,
          caddress: '',
          ccity: '',
          cstate: 'Madhya Pradesh',
          cdistrict: '',
          cpincode: '',
        }));
      }
    }
  };

  // ── AADHAAR OTP API (commented out — re-enable when OTP service is active) ──────
  // const aadharverification = async () => {
  //   if (formdata.aadharnumber.length !== 12) {
  //     toast.error('Invalid Aadhaar Number');
  //     return;
  //   }
  //   showLoader();
  //   try {
  //     const aadharOtpBase = import.meta.env.VITE_AADHAR_OTP_URL || 'https://apipoultry.duniyape.in/api/aadhar';
  //     const res = await axios.post(`${aadharOtpBase}/send-otp`, { uid: formdata.aadharnumber });
  //     console.log(res.data);
  //     const transactionId = res.data?.data?.sessionId;
  //     setformdata({ ...formdata, aadhartxn: transactionId });
  //     setOtpShow(true);
  //     toast.success(res.data?.data?.message || 'OTP sent successfully');
  //   } catch (error) {
  //     console.error(error);
  //     toast.error(error?.response?.data?.message || 'Server Error');
  //   } finally {
  //     hideLoader();
  //   }
  // };

  const [Otp, setOtp] = useState('');

  // ── AADHAAR OTP VERIFY API (commented out — re-enable when OTP service is active) ─
  // const aadharOTPsent = async () => {
  //   if (!formdata.aadhartxn || Otp.length !== 6) {
  //     toast.error('Invalid OTP');
  //     return;
  //   }
  //   showLoader();
  //   try {
  //     const aadharOtpBase = import.meta.env.VITE_AADHAR_OTP_URL || 'https://apipoultry.duniyape.in/api/aadhar';
  //     const res = await axios.post(`${aadharOtpBase}/verify-otp`, { otp: Otp, sessionId: formdata.aadhartxn });
  //     const data = res.data;
  //     console.log(data);
  //     if (data?.success === false) { toast.error(data.message || 'OTP verification failed'); return; }
  //     setaadhardata(data?.data);
  //     setOtpShow(false);
  //     toast.success('Aadhaar verified successfully');
  //   } catch (error) {
  //     console.error(error);
  //     if (error.response) { toast.error(error.response.data?.message || 'API Error'); }
  //     else if (error.request) { toast.error('Server not reachable'); }
  //     else { toast.error('Something went wrong'); }
  //   } finally {
  //     hideLoader();
  //   }
  // };

  // ── Manual Aadhaar DB Check (active) ───────────────────────────────────────
  const checkAadharExists = async () => {
    const num = formdata.aadharnumber.trim();
    if (num.length !== 12 || !/^\d{12}$/.test(num)) {
      toast.error('Please enter a valid 12-digit Aadhaar number');
      return;
    }
    setAadharChecking(true);
    setAadharStatus(null);
    setAadharVerified(false);
    try {
      const res = await axios.get(`${localprimeBase}/get-members`);
      let rawList = [];
      if (Array.isArray(res.data)) rawList = res.data;
      else if (Array.isArray(res.data?.data)) rawList = res.data.data;
      else if (res.data?.data && typeof res.data.data === 'object') rawList = [res.data.data];

      // Check if any existing member has this Aadhaar number
      const duplicate = rawList.find(
        (m) => String(m.Aadhar || m.aadhaar || m.aadhar || '').trim() === num
      );

      if (duplicate) {
        setAadharStatus('duplicate');
        setAadharVerified(false);
        toast.error('This Aadhaar number is already registered in the system.');
      } else {
        setAadharStatus('ok');
        setAadharVerified(true);
        toast.success('Aadhaar number is unique. You can proceed.');
      }
    } catch (error) {
      console.error('[CreateMember] Aadhaar check error:', error);
      toast.error(error?.response?.data?.message || 'Failed to verify Aadhaar. Please try again.');
    } finally {
      setAadharChecking(false);
    }
  };

  const [aadhardata, setaadhardata] = useState(null);

  useEffect(() => {
    console.log(aadhardata);

    if (aadhardata) {
      setformdata({
        ...formdata,
        fathername: aadhardata.careof,
        firstname: (aadhardata.name || '').split(' ')[0],
        lastname: (aadhardata.name || '').split(' ').pop(),
        pincode: aadhardata.pincode,
        state: aadhardata.state,
        district: aadhardata.district,
        dob: moment(aadhardata.dob, 'DD-MM-YYYY').format('YYYY-MM-DD'),
        sameaddress: true,
        gender: aadhardata.gender === 'M' ? 'Male' : aadhardata.gender === 'F' ? 'Female' : 'Other',
        city: aadhardata.district,
        paddress: `${aadhardata.house}, ${aadhardata.landmark}, ${aadhardata.street}, ${aadhardata.locality}, ${aadhardata.district}, ${aadhardata.state}.`,
        cpincode: aadhardata.pincode,
        cstate: aadhardata.state,
        cdistrict: aadhardata.district,
        ccity: aadhardata.district,
        caddress: `${aadhardata.house}, ${aadhardata.landmark}, ${aadhardata.street}, ${aadhardata.locality}, ${aadhardata.district}, ${aadhardata.state}.`,
      });
    }
  }, [aadhardata]);

  // Auto-fetch location from Postal Pincode API for Address
  const handlePincodeChange = async (val, isCorrespondence = false) => {
    const cleanPin = val.replace(/\D/g, '').slice(0, 6);

    if (isCorrespondence) {
      setformdata((prev) => ({ ...prev, cpincode: cleanPin }));
    } else {
      setformdata((prev) => ({
        ...prev,
        pincode: cleanPin,
        ...(prev.sameaddress ? { cpincode: cleanPin } : {}),
      }));
    }

    if (cleanPin.length === 6) {
      if (isCorrespondence) setFetchingCpin(true);
      else setFetchingPin(true);

      try {
        const res = await axios.get(`https://api.postalpincode.in/pincode/${cleanPin}`);
        if (res.data && res.data[0] && res.data[0].Status === 'Success' && res.data[0].PostOffice?.length > 0) {
          const po = res.data[0].PostOffice[0];
          const apiState = po.State || '';
          const apiDistrict = po.District || '';
          const apiCity = po.District || po.Block || po.Name || '';

          const matchedState = statejosn.find((s) => s.state?.toLowerCase() === apiState.toLowerCase())?.state || apiState;
          const stateObj = statejosn.find((s) => s.state?.toLowerCase() === (matchedState || '').toLowerCase());
          const matchedDistrict = stateObj?.districts?.find((d) => d.toLowerCase() === apiDistrict.toLowerCase()) || apiDistrict;

          if (isCorrespondence) {
            setformdata((prev) => ({
              ...prev,
              cstate: matchedState,
              cdistrict: matchedDistrict,
              ccity: prev.ccity || apiCity,
            }));
          } else {
            setformdata((prev) => ({
              ...prev,
              state: matchedState,
              district: matchedDistrict,
              city: prev.city || apiCity,
              ...(prev.sameaddress
                ? {
                    cstate: matchedState,
                    cdistrict: matchedDistrict,
                    ccity: prev.ccity || apiCity,
                  }
                : {}),
            }));
          }
          toast.success(`Location: ${matchedDistrict}, ${matchedState}`);
        } else {
          toast.error(`Pincode ${cleanPin} not found`);
        }
      } catch (err) {
        console.warn('Pincode fetch error:', err);
      } finally {
        if (isCorrespondence) setFetchingCpin(false);
        else setFetchingPin(false);
      }
    }
  };

  const create = async (e) => {
    e.preventDefault();
    console.log('create started', formdata);
    showLoader();

    // Ensure all 5 images are compressed to keep total request size well within Nginx 1MB limit
    let compressedPhoto = formdata.photo;
    let compressedIdFront = formdata.idfront;
    let compressedIdBack = formdata.idback;
    let compressedAddFront = formdata.addfront;
    let compressedAddBack = formdata.addback;

    try {
      if (compressedPhoto && typeof compressedPhoto === 'object') {
        compressedPhoto = await compressImage(compressedPhoto);
      }
      if (compressedIdFront && typeof compressedIdFront === 'object') {
        compressedIdFront = await compressImage(compressedIdFront);
      }
      if (compressedIdBack && typeof compressedIdBack === 'object') {
        compressedIdBack = await compressImage(compressedIdBack);
      }
      if (compressedAddFront && typeof compressedAddFront === 'object') {
        compressedAddFront = await compressImage(compressedAddFront);
      }
      if (compressedAddBack && typeof compressedAddBack === 'object') {
        compressedAddBack = await compressImage(compressedAddBack);
      }
    } catch (compressErr) {
      console.warn('Pre-submit compression warning:', compressErr);
    }

    const formDataPayload = new FormData();

    // Personal & Address Text Fields
    formDataPayload.append('Aadhar', formdata.aadharnumber || '');
    formDataPayload.append('BranchName', formdata.branchname || '');
    formDataPayload.append('BranchCode', formdata.branch || '');
    formDataPayload.append('ReceiptDate', moment(new Date()).format('yyyy-MM-DD'));
    formDataPayload.append('MemberCategory', formdata.membertype || 'Ordinary');
    formDataPayload.append('Title', formdata.title || '');
    formDataPayload.append('FirstName', formdata.firstname || '');
    formDataPayload.append('LastName', formdata.lastname || '');
    formDataPayload.append('RelationOf', 'xx');
    formDataPayload.append('FatherName', formdata.fathername || '');
    formDataPayload.append('DateOfBirth', formdata.dob || '');
    formDataPayload.append('Age', formdata.age || '');
    formDataPayload.append('Gender', formdata.gender || '');
    formDataPayload.append('Category', formdata.category || '');
    formDataPayload.append('MobileNo', formdata.mobile || '');
    formDataPayload.append('Email', formdata.email || '');
    formDataPayload.append('Occupation', formdata.occupation || '');
    formDataPayload.append('OfficialAdd', formdata.officeaddress || '');
    formDataPayload.append('MonthlyIncome', formdata.income || '');

    // Second Page
    formDataPayload.append('PermanentAdd', formdata.paddress || '');
    formDataPayload.append('City', formdata.city || '');
    formDataPayload.append('District', formdata.district || '');
    formDataPayload.append('State', formdata.state || '');
    formDataPayload.append('PinCode', formdata.pincode || '');
    formDataPayload.append('SameAddress', formdata.sameaddress ? 'true' : 'false');
    formDataPayload.append('ResidenceAdd', formdata.caddress || '');
    formDataPayload.append('RCity', formdata.ccity || '');
    formDataPayload.append('RDistrict', formdata.cdistrict || '');
    formDataPayload.append('Rstate', formdata.cstate || '');
    formDataPayload.append('RPinCode', formdata.cpincode || '');

    formDataPayload.append('MemberId', formdata.introducerid || '');
    formDataPayload.append('MemberName', formdata.introducername || '');
    formDataPayload.append('Duration', formdata.peroidknown || '');

    // Third Page
    formDataPayload.append('NomTitle', formdata.nomineetitle || '');
    formDataPayload.append('NomName', formdata.nomineename || '');
    formDataPayload.append('NomRelation', formdata.nomineerelation || '');
    formDataPayload.append('NomAge', formdata.nomineeage || '');
    formDataPayload.append('NomDOB', formdata.nomineedob || '');
    formDataPayload.append('NomAddress', formdata.nomineeaddress || '');

    formDataPayload.append('GurName', formdata.gurdianname || '');
    formDataPayload.append('GurRelationship', formdata.gurdianrelation || '');
    formDataPayload.append('GurAge', formdata.gurdianage || '');

    formDataPayload.append('KycIdproof', formdata.idproof || '');
    formDataPayload.append('KycOther', 'xx');
    formDataPayload.append('KycDocNo', formdata.idproofnumber || '');
    formDataPayload.append('KycAddProof', formdata.addressproof || '');
    formDataPayload.append('KycTother', 'xx');
    formDataPayload.append('KycTdocNo', formdata.addressproofnumber || '');
    formDataPayload.append('EmpID', 'xx');
    formDataPayload.append('Status', 'Active');

    // Image Uploads (Multipart Files)
    // Note: Backend multer saves UploadPhoto, UploadId, UploadId2, UploadAddress, UploadAddress2 to S3
    if (compressedPhoto) {
      const name = compressedPhoto.name || 'photo.jpg';
      formDataPayload.append('UploadPhoto', compressedPhoto, name);
      formDataPayload.append('photo', compressedPhoto, name);
    }
    if (compressedIdFront) {
      const name = compressedIdFront.name || 'idfront.jpg';
      formDataPayload.append('UploadId', compressedIdFront, name);
      formDataPayload.append('idfront', compressedIdFront, name);
    }
    if (compressedIdBack) {
      const name = compressedIdBack.name || 'idback.jpg';
      formDataPayload.append('UploadId2', compressedIdBack, name);
      formDataPayload.append('idback', compressedIdBack, name);
    }
    if (compressedAddFront) {
      const name = compressedAddFront.name || 'addfront.jpg';
      formDataPayload.append('UploadAddress', compressedAddFront, name);
      formDataPayload.append('addfront', compressedAddFront, name);
    }
    if (compressedAddBack) {
      const name = compressedAddBack.name || 'addback.jpg';
      formDataPayload.append('UploadAddress2', compressedAddBack, name);
      formDataPayload.append('addback', compressedAddBack, name);
    }

    console.log('--- Multipart FormData Payload Entries ---');
    for (let pair of formDataPayload.entries()) {
      console.log(pair[0] + ':', typeof pair[1] === 'object' ? `${pair[1].name} (${pair[1].size} bytes)` : pair[1]);
    }

    const api = `${localprimeBase}/create-member-request`;
    console.log('Sending member request to:', api);
    try {
      const headers = {
        ...(localprimeBase.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
      };

      const res = await axios.post(api, formDataPayload, {
        headers,
        timeout: 60000,
      });

      console.log('Create Member Request API Success Response:', res.data);
      toast.success(res.data?.message || 'Member Request Submitted! Pending admin approval.');
      setformdata({
        ...initialFormData,
        introducername: formdata.introducername,
        branch: formdata.branch,
        branchname: formdata.branchname,
      });
      setCompressingStatus({});
      settab(1);
    } catch (error) {
      console.error('Error creating member request:', error);
      let errorMsg = 'Failed to submit member request';
      if (error?.response?.status === 413) {
        errorMsg = 'Uploaded files are too large. Please select smaller images or lower resolution.';
      } else if (error.message === 'Network Error') {
        errorMsg = 'Network Error: Request failed. Please check internet connection or image file size.';
      } else if (error?.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      toast.error(errorMsg);
    } finally {
      hideLoader();
    }
  };

  // Fetch introducer details — only approved (get-members) members can be introducers
  const getformdata = async (targetMid) => {
    const mid = (targetMid || formdata.introducerid || '').trim();
    if (!mid || mid.length < 4) return;
    showLoader();
    try {
      // Fetch from get-members (approved members only) — only approved members can introduce new members
      const res = await axios.get(`${localprimeBase}/get-members`);
      let rawList = [];
      if (Array.isArray(res.data)) rawList = res.data;
      else if (Array.isArray(res.data?.data)) rawList = res.data.data;
      else if (res.data?.data && typeof res.data.data === 'object') rawList = [res.data.data];

      console.log('[CreateMember] Looking for introducer ID:', mid, 'in', rawList.length, 'approved members');

      // Match by memberId (lowercase), member_id, MemberNo, or smart-scan for padded IDs
      const search = mid.toLowerCase();
      const data = rawList.find((m) => {
        // Try all known ID fields
        const ids = [
          m.memberId, m.member_id, m.MemberNo, m.memberNo, m.member_no,
          m.MemberCode, m.memberCode, m._id,
        ].map((v) => String(v || '').toLowerCase().trim());
        if (ids.some((id) => id === search)) return true;

        // Smart scan: look for padded-number fields matching the search
        // EXCLUDE memberid (case-insensitive) — that's the INTRODUCER's ID, not the member's own
        for (const [k, v] of Object.entries(m)) {
          const lk = k.toLowerCase();
          if (lk === 'memberid') continue; // skip introducer ID field
          if (typeof v === 'string' && /^0\d{4,11}$/.test(v.trim()) && v.trim().toLowerCase() === search) {
            return true;
          }
        }
        return false;
      });

      if (!data) {
        // Not found in approved members
        toast.error(`Member ID "${mid}" not found or not yet approved. Only approved members can be introducers.`);
        setformdata((prev) => ({ ...prev, introducername: '', branch: '', branchname: '' }));
        return;
      }

      // Verify this member is approved/active
      const memberStatus = (data.status || data.Status || '').toLowerCase();
      if (memberStatus === 'pending' || memberStatus === 'rejected') {
        toast.error(`Member ID "${mid}" is ${memberStatus}. Only approved members can be introducers.`);
        setformdata((prev) => ({ ...prev, introducername: '', branch: '', branchname: '' }));
        return;
      }

      // ⚠️  IMPORTANT: MemberName = INTRODUCER's name (not this member's own name)
      // Always use FirstName + LastName for the member's own name.
      const firstName = data.FirstName || data.firstname || data.first_name || '';
      const lastName = data.LastName || data.lastname || data.last_name || '';
      const name = `${firstName} ${lastName}`.trim() || mid;

      const branchCode = data.BranchCode || data.branchCode || '001';
      const branchName = data.BranchName || data.branchName || '';

      setformdata((prev) => ({
        ...prev,
        introducername: name,
        branch: branchCode,
        branchname: branchName,
      }));

      toast.success(`Introducer found: ${name}`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.warn(`Member ID "${mid}" not found.`);
        setformdata((prev) => ({ ...prev, introducername: '' }));
      } else {
        console.error('Error fetching member data:', error);
        toast.error('Failed to fetch member details. Please try again.');
      }
    } finally {
      hideLoader();
    }
  };


  useEffect(() => {
    const cleanId = (formdata.introducerid || '').trim();
    if (cleanId.length >= 7) {
      const timer = setTimeout(() => {
        getformdata(cleanId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formdata.introducerid]);

  const handleNext = (e) => {
    e.preventDefault();
    // For tab 1, require Aadhaar to be verified (not a duplicate)
    if (tab === 1 && !aadharVerified) {
      toast.error('Please verify your Aadhaar number before proceeding.');
      return;
    }
    console.log('Proceed to next step:');
    settab((prev) => prev + 1);
  };
  const handlePrevious = () => {
    console.log('Proceed to previous step:');
    settab((prev) => prev - 1);
  };

  const handleTabChange = (targetTabIndex) => {
    if (targetTabIndex <= tab) {
      settab(targetTabIndex);
    }
  };

  function calculateAge(dob) {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : 0;
  }

  useEffect(() => {
    if (formdata.dob) {
      setformdata((prev) => ({ ...prev, age: `${calculateAge(prev.dob)}` }));
    }
  }, [formdata.dob]);

  useEffect(() => {
    if (formdata.nomineedob) {
      setformdata((prev) => ({ ...prev, nomineeage: `${calculateAge(prev.nomineedob)}` }));
    }
  }, [formdata.nomineedob]);

  useEffect(() => {
    if (formdata.gurdiandob) {
      setformdata((prev) => ({ ...prev, gurdianage: `${calculateAge(prev.gurdiandob)}` }));
    }
  }, [formdata.gurdiandob]);

  useEffect(() => {
    getformdata();
  }, []);

  return (
    <div style={container}>
      <h2 style={{ textAlign: 'center', color: '#b4a383', fontSize: '18px', marginBottom: '20px', position: 'relative' }}>
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
        ></i>
        Member Application
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Step 1 */}
        <button
          type="button"
          onClick={() => handleTabChange(1)}
          style={{
            width: 50,
            height: 50,
            backgroundColor: tab >= 1 ? '#B1FFBF' : '#F0F0F0',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${tab >= 1 ? '#2D7809' : '#BABABA'}`,
            cursor: 'pointer',
          }}
        >
          <i className={`fa-solid fa-user`} style={{ color: tab >= 1 ? '#2D7809' : '#BABABA', fontSize: 18 }} />
        </button>

        <div style={{ width: 34, height: 2, backgroundColor: tab > 1 ? '#2D7809' : '#F0F0F0' }}></div>

        {/* Step 2 */}
        <button
          type="button"
          onClick={() => handleTabChange(2)}
          style={{
            width: 50,
            height: 50,
            backgroundColor: tab > 1 ? '#B1FFBF' : '#F0F0F0',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${tab > 1 ? '#2D7809' : '#BABABA'}`,
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-location-dot" style={{ color: tab > 1 ? '#2D7809' : '#BABABA', fontSize: 18 }} />
        </button>

        <div style={{ width: 37, height: 2, backgroundColor: tab > 2 ? '#2D7809' : '#F0F0F0' }}></div>

        {/* Step 3 */}
        <button
          type="button"
          onClick={() => handleTabChange(3)}
          style={{
            width: 50,
            height: 50,
            backgroundColor: tab > 2 ? '#B1FFBF' : '#F0F0F0',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${tab > 2 ? '#2D7809' : '#BABABA'}`,
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-users" style={{ color: tab > 2 ? '#2D7809' : '#BABABA', fontSize: 18 }} />
        </button>

        <div style={{ width: 25, height: 2, backgroundColor: tab > 3 ? '#2D7809' : '#F0F0F0' }}></div>

        {/* Step 4 */}
        <button
          type="button"
          onClick={() => handleTabChange(4)}
          style={{
            width: 50,
            height: 50,
            backgroundColor: tab > 3 ? '#B1FFBF' : '#F0F0F0',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${tab > 3 ? '#2D7809' : '#BABABA'}`,
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-upload" style={{ color: tab > 3 ? '#2D7809' : '#BABABA', fontSize: 18 }} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5, marginBottom: 20 }}>
        <p style={{ fontSize: 10, width: 75, textAlign: 'center', padding: '0 4px' }}>Personal Details</p>
        <p style={{ fontSize: 10, width: 100, textAlign: 'center', padding: '0 4px' }}>Correspondence Details</p>
        <p style={{ fontSize: 10, width: 75, textAlign: 'center', padding: '0 4px' }}>Nomination Details</p>
        <p style={{ fontSize: 10, width: 75, textAlign: 'center', padding: '0 4px' }}>Upload Documents</p>
      </div>

      {tab === 1 && (
        <form onSubmit={handleNext}>
          {/* ── Aadhaar Section (Manual Check Mode) ─────────────────────── */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Aadhaar No. <span style={{ color: 'red' }}>*</span></label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                required
                value={formdata.aadharnumber}
                onChange={(e) => {
                  const num = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setformdata({ ...formdata, aadharnumber: num });
                  // Reset verification status when user edits the number
                  setAadharVerified(false);
                  setAadharStatus(null);
                }}
                type="text"
                maxLength={12}
                inputMode="numeric"
                pattern="\d{12}"
                placeholder="Enter 12-digit Aadhaar No."
                style={{ ...inputStyle, flex: 1, letterSpacing: '2px', height: '42px', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={checkAadharExists}
                disabled={aadharChecking || formdata.aadharnumber.length !== 12}
                style={{
                  height: '42px',
                  width: 'auto',
                  padding: '0 20px',
                  backgroundColor: aadharVerified ? '#16a34a' : '#385FBF',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: (aadharChecking || formdata.aadharnumber.length !== 12) ? 'not-allowed' : 'pointer',
                  opacity: (aadharChecking || formdata.aadharnumber.length !== 12) ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  boxShadow: aadharVerified ? '0 2px 6px rgba(22, 163, 74, 0.3)' : '0 2px 6px rgba(56, 95, 191, 0.3)',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
              >
                {aadharChecking ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 13 }} />
                    Checking...
                  </>
                ) : aadharVerified ? (
                  <>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: 13 }} />
                    Verified
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-shield-halved" style={{ fontSize: 13 }} />
                    Verify Aadhaar
                  </>
                )}
              </button>
            </div>

            {/* ── Aadhaar Status Banner ─────────────────────────────── */}
            {aadharStatus === 'ok' && (
              <div style={{
                marginTop: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#d1fae5',
                border: '1px solid #6ee7b7',
                color: '#065f46',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: 14, color: '#059669' }} />
                Aadhaar verified — this number is not registered in the system. You may proceed.
              </div>
            )}
            {aadharStatus === 'duplicate' && (
              <div style={{
                marginTop: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <i className="fa-solid fa-circle-xmark" style={{ fontSize: 14, color: '#dc2626' }} />
                This Aadhaar number is already registered. Please use a different Aadhaar.
              </div>
            )}
          </div>

          {/* ── Commented-out OTP flow — re-enable when OTP API is active ── */}
          {/* <button type="button" onClick={() => aadharverification()} style={buttonStyle}>Get OTP</button> */}
          {/* {OtpShow && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>OTP</label>
                <input required value={Otp} onChange={(e) => setOtp(e.target.value)}
                  type="number" placeholder="Enter Here" style={inputStyle} />
              </div>
              <button type="button" onClick={() => aadharOTPsent()} style={buttonStyle}>Verify</button>
            </>
          )} */}

          {/* Form Fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: 16 }}>
            {[
              { label: 'Title', type: 'select', name: 'title', options: ['Mr', 'Mrs', 'Miss'] },
              { label: 'First Name', name: 'firstname' },
              { label: 'Last Name', name: 'lastname' },
              { label: 'Father/Husband Name', name: 'fathername' },
              { label: 'Date of Birth', name: 'dob', type: 'date' },
              { label: 'Age', name: 'age', type: 'number' },
              {
                label: 'Gender',
                type: 'select',
                name: 'gender',
                options: ['Male', 'Female', 'Other'],
              },
              {
                label: 'Category',
                type: 'select',
                name: 'category',
                options: ['General', 'OBC', 'SC', 'ST'],
              },
              {
                label: 'Member Type',
                type: 'select',
                name: 'membertype',
                options: ['Ordinary', 'Agent', 'Regular', 'Associate', 'Senior'],
              },
              { label: 'Mobile', name: 'mobile', type: 'tel' },
              { label: 'Email', name: 'email', type: 'email' },
              { label: 'Occupation', name: 'occupation' },
              { label: 'Monthly Income', name: 'income', type: 'number' },
            ].map((field, idx) => (
              <div key={idx} style={formItem}>
                <label style={labelStyle}>{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    required
                    value={formdata[field.name]}
                    onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    {field.options.map((opt, i) => (
                      <option key={i}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    disabled={field.name === 'age'}
                    value={formdata[field.name]}
                    maxLength={field.name === 'mobile' ? 10 : undefined}
                    inputMode={field.name === 'mobile' ? 'numeric' : undefined}
                    placeholder={field.name === 'mobile' ? 'Enter 10-digit mobile number' : undefined}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (field.name === 'mobile') {
                        val = val.replace(/\D/g, '').slice(0, 10);
                      }
                      setformdata({ ...formdata, [field.name]: val });
                    }}
                    type={field.type || 'text'}
                    style={inputStyle}
                    pattern={field.type === 'tel' ? '[6-9]{1}[0-9]{9}' : undefined}
                    title={field.name === 'mobile' ? 'Please enter a valid 10-digit mobile number' : undefined}
                  />
                )}
              </div>
            ))}

            {/* Official Address */}
            <div style={{ flex: '1 1 100%' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#b4a383' }}>
                Official Address
              </label>
              <textarea
                required
                value={formdata.officeaddress}
                onChange={(e) => setformdata({ ...formdata, officeaddress: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                rows={3}
              />
            </div>
          </div>

          {/* Next Button */}
          <button type="submit" style={buttonStyle}>
            Next
          </button>
        </form>
      )}

      {tab === 2 && (
        <form onSubmit={handleNext}>
          {/* Form Fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {[
              { label: 'Permanent Address', name: 'paddress' },
              { label: 'City', name: 'city' },
              {
                label: 'State',
                type: 'select',
                name: 'state',
                options: statejosn,
              },
              {
                label: 'District',
                type: 'select',
                name: 'district',
                options: (statejosn.find((s) => s.state === formdata.state) || statejosn[0])?.districts || [],
              },
              { label: 'Pin Code', name: 'pincode', type: 'text' },
            ].map((field, idx) => (
              <div key={idx} style={formItem}>
                <label style={labelStyle}>
                  {field.label}
                  {field.name === 'pincode' && fetchingPin && (
                    <span style={{ fontSize: '11px', color: '#385FBF', marginLeft: '8px', fontWeight: 'normal' }}>
                      <i className="fa-solid fa-spinner fa-spin" /> Fetching location...
                    </span>
                  )}
                </label>
                {field.type === 'select' ? (
                  <select
                    required
                    value={formdata[field.name]}
                    onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    {field.options.map((opt, i) => (
                      <option key={i}>{field.label === 'State' ? opt.state : opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={formdata[field.name]}
                    maxLength={field.name === 'pincode' ? 6 : undefined}
                    inputMode={field.name === 'pincode' ? 'numeric' : undefined}
                    placeholder={field.name === 'pincode' ? 'Enter 6-digit Pincode' : undefined}
                    onChange={(e) => {
                      if (field.name === 'pincode') {
                        handlePincodeChange(e.target.value, false);
                      } else {
                        setformdata({ ...formdata, [field.name]: e.target.value });
                      }
                    }}
                    type={field.type || 'text'}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>

          <h4 style={{ marginTop: 20 }}>Residence Details</h4>
          <label>
            <input
              type="checkbox"
              name="sameAsPermanent"
              checked={formdata.sameaddress}
              onChange={handleChange}
              style={{ marginRight: 8, marginBottom: 25 }}
            />
            Same as Permanent Address
          </label>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {[
              { label: 'Residence Address', name: 'caddress' },
              { label: 'City', name: 'ccity' },
              {
                label: 'State',
                type: 'select',
                name: 'cstate',
                options: statejosn,
              },
              {
                label: 'District',
                type: 'select',
                name: 'cdistrict',
                options: (statejosn.find((s) => s.state === formdata.cstate) || statejosn[0])?.districts || [],
              },
              { label: 'Pin Code', name: 'cpincode', type: 'text' },
            ].map((field, idx) => (
              <div key={idx} style={formItem}>
                <label style={labelStyle}>
                  {field.label}
                  {field.name === 'cpincode' && fetchingCpin && (
                    <span style={{ fontSize: '11px', color: '#385FBF', marginLeft: '8px', fontWeight: 'normal' }}>
                      <i className="fa-solid fa-spinner fa-spin" /> Fetching location...
                    </span>
                  )}
                </label>
                {field.type === 'select' ? (
                  <select
                    required
                    value={formdata[field.name]}
                    onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    {field.options.map((opt, i) => (
                      <option key={i}>{field.name === 'cstate' ? opt.state : opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    disabled={formdata.sameaddress}
                    value={formdata[field.name]}
                    maxLength={field.name === 'cpincode' ? 6 : undefined}
                    inputMode={field.name === 'cpincode' ? 'numeric' : undefined}
                    placeholder={field.name === 'cpincode' ? 'Enter 6-digit Pincode' : undefined}
                    onChange={(e) => {
                      if (field.name === 'cpincode') {
                        handlePincodeChange(e.target.value, true);
                      } else {
                        setformdata({ ...formdata, [field.name]: e.target.value });
                      }
                    }}
                    type={field.type || 'text'}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 20, marginBottom: '16px', borderBottom: 'solid' }}>Introducer Details:</h3>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Member ID</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                required
                value={formdata.introducerid}
                onChange={(e) => setformdata({ ...formdata, introducerid: e.target.value })}
                onBlur={() => getformdata(formdata.introducerid)}
                type="text"
                placeholder="Enter member ID (e.g. 0010001)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => getformdata(formdata.introducerid)}
                style={{ ...buttonStyle, width: 'auto', marginBottom: 0, padding: '0 20px' }}
              >
                Fetch
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            {[
              { label: 'Name', name: 'introducername' },
              { label: 'Period Known', name: 'peroidknown', type: 'number' },
            ].map((field, idx) => (
              <div key={idx} style={formItem}>
                <label style={labelStyle}>{field.label}</label>
                <input
                  required
                  value={formdata[field.name]}
                  onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                  type={field.type || 'text'}
                  style={inputStyle}
                  placeholder={field.name === 'introducername' ? 'Auto-filled from Member ID' : ''}
                />
              </div>
            ))}
          </div>

          <button type="submit" style={buttonStyle}>
            Next
          </button>
          <button type="button" onClick={handlePrevious} style={buttonStyle}>
            Previous
          </button>
        </form>
      )}

      {tab === 3 && (
        <form onSubmit={handleNext}>
          {/* Form Fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: 16 }}>
            {[
              { label: 'Title', type: 'select', name: 'nomineetitle', options: ['Mr', 'Mrs', 'Miss'] },
              { label: 'Name', name: 'nomineename' },
              {
                label: 'Relationship',
                type: 'select',
                name: 'nomineerelation',
                options: ['Son', 'Wife', 'Father', 'Mother'],
              },
              { label: 'Date of Birth', name: 'nomineedob', type: 'date' },
              { label: 'Age', name: 'nomineeage', type: 'number' },
              { label: 'Address', name: 'nomineeaddress' },
            ].map((field, idx) => (
              <div key={idx} style={formItem}>
                <label style={labelStyle}>{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    required
                    value={formdata[field.name]}
                    onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    {field.options.map((opt, i) => (
                      <option key={i}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    disabled={field.name === 'nomineeage'}
                    value={formdata[field.name]}
                    onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                    type={field.type || 'text'}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>

          {(formdata.nomineeage < 18 || formdata.nomineeage === '') && (
            <>
              <h4 style={{ margin: '20px 0' }}>Guardian Details</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                {[
                  { label: 'Title', type: 'select', name: 'gurdiantitle', options: ['Mr', 'Mrs', 'Miss'] },
                  { label: 'Name', name: 'gurdianname' },
                  {
                    label: 'Relationship',
                    type: 'select',
                    name: 'gurdianrelation',
                    options: ['Son', 'Wife', 'Father', 'Mother'],
                  },
                  { label: 'Date of Birth', name: 'gurdiandob', type: 'date' },
                  { label: 'Age', name: 'gurdianage', type: 'number' },
                ].map((field, idx) => (
                  <div key={idx} style={formItem}>
                    <label style={labelStyle}>{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        required
                        value={formdata[field.name]}
                        onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Select</option>
                        {field.options.map((opt, i) => (
                          <option key={i}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        value={formdata[field.name]}
                        disabled={field.name === 'gurdianage'}
                        onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                        type={field.type || 'text'}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <button type="submit" style={buttonStyle}>
            Next
          </button>
          <button type="button" onClick={handlePrevious} style={buttonStyle}>
            Previous
          </button>
        </form>
      )}

      {tab === 4 && (
        <form onSubmit={create}>
          {/* Form Fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            {[
              {
                label: 'ID Proof',
                type: 'select',
                name: 'idproof',
                options: ['Aadhar', 'PAN', 'Voter ID', 'Passport', 'Driving License', 'Govt. ID', 'Other'],
              },
              { label: 'Document Number', name: 'idproofnumber', type: 'text' },
              {
                label: 'Address Proof',
                type: 'select',
                name: 'addressproof',
                options: ['Aadhar', 'PAN', 'Voter ID', 'Passport', 'Driving License', 'Govt. ID', 'Other'],
              },
              { label: 'Document Number', name: 'addressproofnumber', type: 'text' },
              { label: 'Upload Photo', name: 'photo', type: 'file' },
              { label: 'Upload ID Front', name: 'idfront', type: 'file' },
              { label: 'Upload ID Back', name: 'idback', type: 'file' },
              { label: 'Upload Address Front', name: 'addfront', type: 'file' },
              { label: 'Upload Address Back', name: 'addback', type: 'file' },
            ].map((field, idx) => (
              <div key={idx} style={formItem}>
                <label style={labelStyle}>{field.label}</label>

                {field.type === 'select' ? (
                  <select
                    required
                    value={formdata[field.name] || ''}
                    onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    {field.options.map((opt, i) => (
                      <option key={i}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'file' ? (
                  <div style={{ width: '100%' }}>
                    <input
                      required
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setCompressingStatus((prev) => ({ ...prev, [field.name]: 'compressing' }));
                          try {
                            const compressed = await compressImage(file);
                            setformdata((prev) => ({ ...prev, [field.name]: compressed }));
                            setCompressingStatus((prev) => ({
                              ...prev,
                              [field.name]: `Ready (${(compressed.size / 1024).toFixed(0)} KB)`,
                            }));
                          } catch (err) {
                            console.warn('Compress failed, using original', err);
                            setformdata((prev) => ({ ...prev, [field.name]: file }));
                            setCompressingStatus((prev) => ({ ...prev, [field.name]: 'ready' }));
                          }
                        }
                      }}
                      style={inputStyle}
                    />
                    {compressingStatus[field.name] === 'compressing' && (
                      <span style={{ fontSize: '11px', color: '#385FBF', marginTop: '4px', display: 'inline-block' }}>
                        <i className="fa-solid fa-spinner fa-spin" /> Compressing image...
                      </span>
                    )}
                    {compressingStatus[field.name] && compressingStatus[field.name].startsWith('Ready') && (
                      <span style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', display: 'inline-block', fontWeight: '500' }}>
                        <i className="fa-solid fa-circle-check" /> {compressingStatus[field.name]}
                      </span>
                    )}
                  </div>
                ) : (
                  <input
                    required
                    value={formdata[field.name] || ''}
                    onChange={(e) => setformdata({ ...formdata, [field.name]: e.target.value })}
                    type={field.type || 'text'}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>

          <button type="submit" style={buttonStyle}>
            Submit
          </button>
          <button type="button" onClick={handlePrevious} style={buttonStyle}>
            Previous
          </button>
        </form>
      )}
    </div>
  );
};

const container = {
  maxWidth: '800px',
  margin: 'auto',
  padding: '20px',
  backgroundColor: '#fff',
  borderRadius: '10px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  fontFamily: 'Arial, sans-serif',
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: 'bold',
  color: '#b4a383',
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #b4a383',
};

const buttonStyle = {
  width: '100%',
  backgroundColor: '#385FBF',
  color: '#b4a383',
  padding: '10px',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  marginBottom: '20px',
  cursor: 'pointer',
};

const formItem = {
  flex: '1 1 48%',
  minWidth: '250px',
};

export default MemberApplicationForm;
