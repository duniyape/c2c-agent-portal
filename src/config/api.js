/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         CENTRAL API CONFIGURATION                        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// DOMAIN ko change karke aap local ya live pe test kar sakte hain.
// Abhi ye aapke Local server (ya IP address) par set hai:
export const DOMAIN = 'https://api.care2connect.in'; // Ya aap 'http://192.168.29.39:5001' likh sakte hain ya 'https://api.care2connect.in'

// --------------------------------------------------------------------------
// AUTOMATICALLY GENERATED ROUTES — DO NOT MODIFY BELOW
// --------------------------------------------------------------------------

export const API_BASE_URL = DOMAIN;
export const API_URL = `${DOMAIN}/badri_enterprises`;
export const BASE_URL = `${API_URL}/localprime`;
export const TRADE_URL = `${API_URL}`;

// Aadhar OTP endpoint
export const AADHAR_OTP_URL = 'https://apipoultry.duniyape.in/api/aadhar';

// Global Axios Interceptor: automatically pass ngrok-skip-browser-warning for ngrok URLs
import axios from 'axios';
axios.interceptors.request.use((config) => {
  if (config.url && (config.url.includes('ngrok') || config.url.includes('ngrok-free.app'))) {
    config.headers = config.headers || {};
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return config;
});
