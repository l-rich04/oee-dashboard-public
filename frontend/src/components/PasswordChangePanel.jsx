import { useState, forwardRef, useImperativeHandle } from "react";
import { changePassword } from "../api/issues";

const PasswordChangePanel = forwardRef(function PasswordChangePanel(props, ref) {
  const [showModal, setShowModal]             = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving]   = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setShowModal(true),
  }));

  const canSubmit = currentPassword && newPassword && confirmPassword && !saving;

  function closeModal() {
    setShowModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => closeModal(), 1500);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: "0.5px solid #ddd", borderRadius: 8,
    fontFamily: "inherit", boxSizing: "border-box",
  };

  if (!showModal) return null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28,
        width: "90%", maxWidth: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Dashboard Password</p>
          <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 18px" }}>
          Change the shared password used to access the Supervisor Dashboard.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Current password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} autoComplete="current-password" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} autoComplete="new-password" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} autoComplete="new-password" />
          </div>
          {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: 0 }}>{error}</p>}
          {success && <p style={{ color: "#0F6E56", fontSize: 12, margin: 0 }}>Password updated successfully.</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 16px", background: "#fff", border: "0.5px solid #ddd", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button type="submit" disabled={!canSubmit} style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 500,
              background: canSubmit ? "#1D9E75" : "#ccc", color: "#fff",
              border: "none", borderRadius: 8,
              cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit",
            }}>
              {saving ? "Saving…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default PasswordChangePanel;