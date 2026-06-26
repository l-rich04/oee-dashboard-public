import { useState } from "react";

const PASSWORD = "1234";

export default function SupervisorLogin({ onSuccess }) {
  const [input, setInput]   = useState("");
  const [error, setError]   = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem("supervisor_auth", "true");
      onSuccess();
    } else {
      setError(true);
      setInput("");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "#f9f9f9",
    }}>
      <div style={{
        background: "#fff", border: "0.5px solid #eee",
        borderRadius: 12, padding: 40, width: 320,
        textAlign: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "#E1F5EE", display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", fontSize: 22,
        }}>🔒</div>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 6px" }}>
          Supervisor Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px" }}>
          Enter your password to continue.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            placeholder="Password"
            autoFocus
            style={{
              width: "100%", padding: "10px 12px",
              fontSize: 14, border: `1px solid ${error ? "#E24B4A" : "#ddd"}`,
              borderRadius: 8, outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
              marginBottom: 8,
            }}
          />
          {error && (
            <p style={{ color: "#A32D2D", fontSize: 12, margin: "0 0 8px" }}>
              Incorrect password. Please try again.
            </p>
          )}
          <button type="submit" style={{
            width: "100%", padding: "11px",
            background: "#1D9E75", color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 14, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}