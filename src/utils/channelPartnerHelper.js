import axios from 'axios';
import Swal from 'sweetalert2';
import { BASE_URL } from '../config/api';

/**
 * Checks whether the logged-in agent has applied for Channel Partner and if it is approved.
 * @returns {Promise<{ applied: boolean, isApproved: boolean, status: string | null, request: object | null }>}
 */
export const checkChannelPartnerStatus = async () => {
  const agentCode = (localStorage.getItem('agentCode') || localStorage.getItem('AUID') || '').trim();
  const agentId = (localStorage.getItem('agent_id') || '').trim();
  const memberId = (localStorage.getItem('MID') || '').trim();

  try {
    const headers = { 'ngrok-skip-browser-warning': 'true' };
    const res = await axios.get(`${BASE_URL}/channel-partner-requests`, {
      headers,
      timeout: 15000,
    });

    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    const matchingRequests = list.filter(
      (r) =>
        (agentCode && (r.agentCode || '').toLowerCase() === agentCode.toLowerCase()) ||
        (agentId && r.agent_id === agentId) ||
        (memberId && (r.memberId || '').toLowerCase() === memberId.toLowerCase())
    );

    if (matchingRequests.length > 0) {
      const isApproved = matchingRequests.some((r) => r.status === 'approved');
      const approvedRecord = matchingRequests.find((r) => r.status === 'approved');
      const latest = matchingRequests[0];
      const finalStatus = isApproved ? 'approved' : (latest.status || 'pending');

      localStorage.setItem('channelPartnerApplied', 'true');
      localStorage.setItem('channelPartnerStatus', finalStatus);
      return {
        applied: true,
        isApproved,
        status: finalStatus,
        request: approvedRecord || latest,
      };
    }

    localStorage.removeItem('channelPartnerApplied');
    localStorage.removeItem('channelPartnerStatus');
    return { applied: false, isApproved: false, status: null, request: null };
  } catch (error) {
    console.warn('Error checking channel partner status:', error);
    const cachedApplied = localStorage.getItem('channelPartnerApplied') === 'true';
    const cachedStatus = localStorage.getItem('channelPartnerStatus');
    const isApproved = cachedStatus === 'approved';

    return {
      applied: cachedApplied,
      isApproved,
      status: cachedStatus || null,
      request: null,
    };
  }
};

/**
 * Verifies that the agent has an APPROVED Channel Partner status before allowing
 * access to Doctor Appointment booking and Appointment List.
 * Shows specific alerts for: Not Applied, Pending Approval, or Rejected.
 * @param {function} navigate - React Router navigate function
 * @returns {Promise<boolean>} true only if approved, false otherwise
 */
export const ensureChannelPartner = async (navigate) => {
  const result = await checkChannelPartnerStatus();

  // 1. Not applied yet
  if (!result.applied) {
    const res = await Swal.fire({
      icon: 'warning',
      title: 'Channel Partner Required',
      text: 'First apply for Channel Partner! Once your application is approved by Admin, you will be able to book doctor appointments and view the appointment list.',
      showCancelButton: true,
      confirmButtonText: 'Apply for Channel Partner',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#385FBF',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    });

    if (res.isConfirmed && navigate) {
      navigate('/channel-partner');
    }
    return false;
  }

  // 2. Applied but Pending Approval
  if (result.status === 'pending') {
    const res = await Swal.fire({
      icon: 'info',
      title: 'Approval Pending',
      text: 'Your Channel Partner application has been submitted and is currently pending approval by Admin. You can book doctor appointments once it is approved.',
      showCancelButton: true,
      confirmButtonText: 'Check Application Status',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#385FBF',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    });

    if (res.isConfirmed && navigate) {
      navigate('/channel-partner');
    }
    return false;
  }

  // 3. Application Rejected
  if (result.status === 'rejected') {
    const res = await Swal.fire({
      icon: 'error',
      title: 'Application Rejected',
      text: 'Your Channel Partner application was rejected. Please re-apply from the Channel Partner page to book doctor appointments.',
      showCancelButton: true,
      confirmButtonText: 'Go to Channel Partner',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#385FBF',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    });

    if (res.isConfirmed && navigate) {
      navigate('/channel-partner');
    }
    return false;
  }

  // 4. Fully Approved
  if (result.isApproved || result.status === 'approved') {
    return true;
  }

  // Fallback for any other unknown non-approved state
  const res = await Swal.fire({
    icon: 'warning',
    title: 'Approval Required',
    text: 'Channel Partner approval is required to access doctor appointments. Please check your Channel Partner status.',
    showCancelButton: true,
    confirmButtonText: 'View Channel Partner',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#385FBF',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
  });

  if (res.isConfirmed && navigate) {
    navigate('/channel-partner');
  }
  return false;
};
