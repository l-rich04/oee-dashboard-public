import { useState, useEffect } from "react";
import { getIssueUpdates, addIssueUpdate, updateIssue } from "../api/issues";

function formatDateTime(ts) {
  return new Date(ts + "Z").toLocaleString([], {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLES = {
  open:        { border: "#E24B4A", bg: "#FCEBEB", color: "#A32D2D" },
  in_progress: { border: "#EF9F27", bg: "#FAEEDA", color: "#854F0B" },
  solved:      { border: "#1D9E75", bg: "#E1F5EE", color: "#0F6E56" },
};

export default function IssueUpdatePanel({ issue, onClose, onSaved }) {
  const [updates, setUpdates]       = useState([]);
  const [status, setStatus]         = useState(issue.status);
  const [note, setNote]             = useState("");
  const [resolution, setResolution] = useState(issue.resolution_note ?? "");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    getIssueUpdates(issue.id).then(setUpdates);
  }, [issue.id]);

  const isReady =
    status === "open" ||
    (status === "in_progress" && note.trim()) ||
    (status === "solved" && resolution.trim());

  async function handleSave() {
    if (!isReady) return;
    setSaving(true);
    setError(null);
    try {
      await updateIssue(issue.id, {
        status,
        resolution_note: status === "solved" ? resolution.trim() : issue.resolution_note,
      });

      if (status === "in_progress" && note.trim()) {
        await addIssueUpdate(issue.id, { note: note.trim() });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      marginTop: 24, padding: 24,
      border: "0.5px solid #eee", borderRadius: 12,
      background: "#fff",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          Issue #{issue.id} — {issue.category.replace(/_/g, " ")}
        </p>
        <button onClick={onClose} style={{
          background: "none", border: "none", fontSize: 18,
          cursor: "pointer", color: "#aaa", lineHeight: 1,
        }}>✕</button>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888" }}>
        {issue.foreman_name} &nbsp;·&nbsp; {new Date(issue.created_at + "Z").toLocaleDateString()}
      </p>

      <div style={divider} />

      <p style={sectionLabel}>Status</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[
          { key: "open",        label: "Open" },
          { key: "in_progress", label: "In Progress" },
          { key: "solved",      label: "Solved" },
        ].map(({ key, label }) => {
          const active = status === key;
          const st = STATUS_STYLES[key];
          return (
            <button key={key} onClick={() => setStatus(key)} style={{
              flex: 1, padding: "9px 6px", borderRadius: 8,
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit", textAlign: "center",
              border: `1.5px solid ${active ? st.border : "#ddd"}`,
              background: active ? st.bg : "#fff",
              color: active ? st.color : "#999",
              transition: "all .15s",
            }}>
              {label}
            </button>
          );
        })}
      </div>

      <div style={divider} />

      {status === "open" && (
        <p style={{ fontSize: 13, color: "#999", fontStyle: "italic", margin: "0 0 16px" }}>
          No further details needed for open issues.
        </p>
      )}

      {status === "in_progress" && (
        <>
          <p style={sectionLabel}>Updates ({updates.length} logged)</p>

          {updates.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {[...updates].reverse().map((u, idx) => (
                <div key={u.id ?? idx} style={{
                  border: "0.5px solid #eee", borderRadius: 8,
                  padding: 12, marginBottom: 8, background: "#fafafa",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>
                      Update {updates.length - idx}
                    </span>
                    <span style={{ fontSize: 11, color: "#1D9E75", fontWeight: 500 }}>
                      {formatDateTime(u.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#333", lineHeight: 1.5 }}>
                    {u.note}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div style={{
            border: "0.5px solid #1D9E75", borderRadius: 8,
            padding: 12, background: "#f0faf6", marginBottom: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>
                Add update #{updates.length + 1}
              </span>
              <span style={{ fontSize: 11, color: "#1D9E75", fontWeight: 500 }}>Today</span>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="What is the current status of this issue?"
              style={textareaStyle}
            />
          </div>
        </>
      )}

      {status === "solved" && (
        <>
          {updates.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={sectionLabel}>Previous updates</p>
              {[...updates].reverse().map((u, idx) => (
                <div key={u.id ?? idx} style={{
                  border: "0.5px solid #eee", borderRadius: 8,
                  padding: 12, marginBottom: 8, background: "#fafafa",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>
                      Update {updates.length - idx}
                    </span>
                    <span style={{ fontSize: 11, color: "#888" }}>
                      {formatDateTime(u.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#333", lineHeight: 1.5 }}>{u.note}</p>
                </div>
              ))}
              <div style={divider} />
            </div>
          )}
          <p style={sectionLabel}>Resolution note</p>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
            Describe how this issue was resolved.
          </p>
          <textarea
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            rows={3}
            placeholder="e.g. Replaced faulty conveyor belt. Machine back in operation."
            style={textareaStyle}
          />
        </>
      )}

      {error && (
        <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={handleSave} disabled={!isReady || saving} style={{
          padding: "9px 20px", background: isReady && !saving ? "#1D9E75" : "#ccc",
          border: "none", borderRadius: 8, color: "#fff",
          fontSize: 13, fontWeight: 500, cursor: isReady ? "pointer" : "not-allowed",
          fontFamily: "inherit",
        }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onClose} style={{
          padding: "9px 14px", background: "#fff",
          border: "0.5px solid #ddd", borderRadius: 8,
          fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#666",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const divider       = { height: "0.5px", background: "#eee", margin: "0 0 16px" };
const sectionLabel  = { fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 8px" };
const textareaStyle = {
  width: "100%", padding: "8px 10px", fontSize: 13,
  border: "0.5px solid #ddd", borderRadius: 8,
  fontFamily: "inherit", resize: "none", outline: "none",
  boxSizing: "border-box", background: "#fff",
};