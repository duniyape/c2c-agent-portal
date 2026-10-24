import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useLoader } from "../loader/LoaderContext";
import { BASE_URL } from "../config/api";

const Login = () => {
  const { showLoader, hideLoader } = useLoader();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    if (!username || !password) {
      toast.error("Please fill in both fields.");
      return;
    }

    try {
      showLoader();
      const api = `${BASE_URL}/agent/login`;
      const payload = {
        agentCode: username,
        password: password,
      };

      const res = await axios.post(api, payload);

      if (res.data && res.data.success) {
        const user = res.data.data;
        console.log("Login successful:", user);

        // Save user data to localStorage
        localStorage.setItem("AUID", user.agentCode || username);
        localStorage.setItem("agentCode", user.agentCode || username);
        if (user._id || user.agent_id || user.id) {
          localStorage.setItem("agent_id", user._id || user.agent_id || user.id);
        }
        localStorage.setItem(
          "Name",
          `${user.FirstName || ""} ${user.LastName || ""}`.trim()
        );
        localStorage.setItem("MID", user.memberId || "");

        // Save additional agent-specific details returned from the backend
        if (user.isAgent !== undefined) localStorage.setItem("isAgent", user.isAgent);
        if (user.agentStatus) localStorage.setItem("agentStatus", user.agentStatus);
        if (user.branchCode) localStorage.setItem("branchCode", user.branchCode);
        if (user.branchName) localStorage.setItem("branchName", user.branchName);
        if (user.designationCode)
          localStorage.setItem("designationCode", user.designationCode);
        if (user.designationName)
          localStorage.setItem("designationName", user.designationName);

        toast.success(res.data.message || "Login successful!");
        navigate("/");
      } else {
        toast.error(res.data?.message || "Invalid username or password.");
      }
    } catch (error) {
      console.error("Login Error:", error);
      toast.error(error.response?.data?.message || "Login failed. Please try again.");
    } finally {
      hideLoader();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e3c72, #2a5298, #ff4e50, #f9d423)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontFamily: "Arial, sans-serif",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .login-box {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 2rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-sizing: border-box;
        }

        .login-logo-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }

        .login-logo-img {
          width: 130px;
          height: 130px;
          object-fit: contain;
          display: block;
          margin: 0 auto;
          border-radius: 50%;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .login-input-field {
          width: 100%;
          padding: 0.75rem 0.75rem 0.75rem 2.5rem;
          border-radius: 8px;
          border: none;
          outline: none;
          font-size: 1rem;
          background-color: #ffffff;
          color: #222222;
          box-sizing: border-box;
          transition: box-shadow 0.2s ease;
        }

        .login-input-field:focus {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4);
        }

        .login-submit-btn {
          padding: 0.75rem;
          border-radius: 20px;
          border: none;
          background-color: rgba(255, 255, 255, 0.85);
          color: #1e3c72;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.3s ease, transform 0.1s ease;
          width: 100%;
        }

        .login-submit-btn:hover {
          background-color: #ffffff;
        }

        .login-submit-btn:active {
          transform: scale(0.99);
        }

        @media (max-width: 480px) {
          .login-box {
            padding: 1.5rem 1.25rem;
            max-width: 100%;
            border-radius: 14px;
          }

          .login-logo-img {
            width: 110px;
            height: 110px;
          }

          .login-input-field {
            font-size: 16px; /* Prevents auto-zoom on mobile browsers */
            padding: 0.7rem 0.75rem 0.7rem 2.4rem;
          }
        }
      `}</style>

      <div className="login-box">
        {/* Centered Logo */}
        <div className="login-logo-wrap">
          <img
            src="/mlogo.png"
            alt="Local Prime Logo"
            className="login-logo-img"
          />
        </div>

        <h2 style={{ textAlign: "center", color: "white", margin: "0" }}>Login</h2>

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}
        >
          {/* User Name */}
          <div style={{ position: "relative", width: "100%" }}>
            <i
              className="fas fa-user"
              style={{
                position: "absolute",
                top: "50%",
                left: "12px",
                transform: "translateY(-50%)",
                color: "#777",
                fontSize: "1rem",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="User Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input-field"
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div style={{ position: "relative", width: "100%" }}>
            <i
              className="fas fa-lock"
              style={{
                position: "absolute",
                top: "50%",
                left: "12px",
                transform: "translateY(-50%)",
                color: "#777",
                fontSize: "1rem",
                pointerEvents: "none",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input-field"
              autoComplete="current-password"
            />
          </div>

          {/* Remember Me */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.9rem",
              color: "white",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={() => setRemember(!remember)}
                style={{ cursor: "pointer" }}
              />
              <span>Remember Me</span>
            </label>
          </div>

          {/* Login Button */}
          <button type="submit" className="login-submit-btn">
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
