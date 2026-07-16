import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { getForemen, getTruckTypes, getDefectTypes, createWorkOrder, addWorkOrderDefect } from "../api/issues";

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split("T")[0];
}

// The backend throws errors as raw JSON text (e.g. {"detail": "..."}).
// This unwraps that into a plain readable string, falling back to the raw
// message if it isn't JSON for some reason.
function extractErrorMessage(err) {
  try {
    const parsed = JSON.parse(err.message);
    return parsed.detail || err.message;
  } catch {
    return err.message || "Something went wrong. Please try again.";
  }
}

export default function DefectForm() {
  const [foremen, setForemen]           = useState([]);
  const [truckTypes, setTruckTypes]     = useState([]);
  const [defectTypes, setDefectTypes]   = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [weekStart, setWeekStart]       = useState(getWeekStart());
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);
  const [submitted, setSubmitted]       = useState(false);
  const [lastSummary, setLastSummary]   = useState({ orders: 0, defects: 0 });

  // A private, ever-increasing counter for generating unique row IDs.
  // Scoped to this component instance via useRef, so it can never collide
  // with IDs from another mount, another tab, or another component's counter.
  const idCounterRef = useRef(0);
  function nextRowId() {
    idCounterRef.current += 1;
    return idCounterRef.current;
  }

  function makeDefectRow() {
    return { rowId: nextRowId(), defectTypeId: "", quantity: "" };
  }

  function makeWorkOrderRow() {
    return { rowId: nextRowId(), workOrderNum: "", truckTypeId: "", defects: [makeDefectRow()] };
  }

  const [workOrderRows, setWorkOrderRows] = useState([makeWorkOrderRow()]);

  // Ref-based submit lock — updates instantly (no render delay), so a rapid
  // double-click or double-Enter can't sneak a second submission through
  // before the button visually disables.
  const submitLockRef = useRef(false);

  useEffect(() => {
    Promise.all([getForemen(), getTruckTypes(), getDefectTypes()]).then(([f, t, d]) => {
      setForemen(f.map(x => x.name));
      setTruckTypes(t);
      setDefectTypes(d);
    });
  }, []);

  // --- Work order row helpers ---

  function updateWorkOrderField(rowId, field, value) {
    setWorkOrderRows(prev =>
      prev.map(wo => (wo.rowId === rowId ? { ...wo, [field]: value } : wo))
    );
  }

  function addWorkOrderRow() {
    setWorkOrderRows(prev => [...prev, makeWorkOrderRow()]);
  }

  function removeWorkOrderRow(rowId) {
    setWorkOrderRows(prev => (prev.length === 1 ? prev : prev.filter(wo => wo.rowId !== rowId)));
  }

  // --- Defect row helpers — every update is scoped to (workOrderRowId, defectRowId) ---

  function addDefectRow(workOrderRowId) {
    setWorkOrderRows(prev =>
      prev.map(wo =>
        wo.rowId !== workOrderRowId
          ? wo
          : { ...wo, defects: [...wo.defects, makeDefectRow()] }
      )
    );
  }

  function removeDefectRow(workOrderRowId, defectRowId) {
    setWorkOrderRows(prev =>
      prev.map(wo =>
        wo.rowId !== workOrderRowId
          ? wo
          : { ...wo, defects: wo.defects.length === 1 ? wo.defects : wo.defects.filter(d => d.rowId !== defectRowId) }
      )
    );
  }

  function updateDefectField(workOrderRowId, defectRowId, field, value) {
    setWorkOrderRows(prev =>
      prev.map(wo =>
        wo.rowId !== workOrderRowId
          ? wo
          : {
              ...wo,
              defects: wo.defects.map(d =>
                d.rowId !== defectRowId ? d : { ...d, [field]: value }
              ),
            }
      )
    );
  }

  // --- Derived values ---

  function defectRowTotal(defects) {
    // Only count rows that actually have a defect type selected — a
    // quantity typed into a row with no type chosen never becomes a real
    // defect record (the submit loop skips it), so it must not be counted
    // in the total sent to the backend either, or the stored total ends up
    // permanently inflated with nothing to correct it afterward.
    return defects.filter(d => d.defectTypeId).reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
  }

  function isWorkOrderValid(wo) {
    return wo.workOrderNum.length === 6 && wo.truckTypeId !== "";
  }

  const validWorkOrders = workOrderRows.filter(isWorkOrderValid);
  const readyCount      = validWorkOrders.length;
  const totalDefects    = workOrderRows.reduce((sum, wo) => sum + defectRowTotal(wo.defects), 0);

  // --- Submit ---

  async function handleSubmit(e) {
    e.preventDefault();
    if (readyCount === 0 || submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true);
    setError(null);

    try {
      for (const wo of validWorkOrders) {
        const truckName = truckTypes.find(t => String(t.id) === String(wo.truckTypeId))?.name ?? "n/a";
        const total      = defectRowTotal(wo.defects);

        const created = await createWorkOrder({
          work_order_num:  wo.workOrderNum,
          truck_type:      truckName,
          units_completed: 1,
          total_defects:   total,
          week_start:      weekStart,
        });

        // Submit each defect row for THIS work order, one at a time, in order.
        // Awaiting each call fully before starting the next removes any
        // possibility of requests overlapping or landing out of order.
        for (const d of wo.defects) {
          const qty = Number(d.quantity) || 0;
          if (d.defectTypeId && qty > 0) {
            await addWorkOrderDefect(created.id, Number(d.defectTypeId), qty);
          }
        }
      }

      setLastSummary({ orders: readyCount, defects: totalDefects });
      setSubmitted(true);
    } catch (err) {
      console.error("Defect report submit error:", err);
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  }

  function resetForm() {
    setWorkOrderRows([makeWorkOrderRow()]);
    setWeekStart(getWeekStart());
    setSubmitted(false);
    setError(null);
  }

  const inputStyle = {
    padding: "6px 8px", fontSize: 12, border: "0.5px solid #ddd",
    borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box",
  };

  if (submitted) {
    return (
      <>
        <Helmet><title>Defect Report</title></Helmet>
        <main style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#E1F5EE", display: "flex",
            alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: 28,
          }}>✓</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 500 }}>Report Submitted</h2>
          <p style={{ color: "#666", margin: "0 0 28px", fontSize: 14 }}>
            {lastSummary.orders} work order{lastSummary.orders !== 1 ? "s" : ""} and {lastSummary.defects} defect{lastSummary.defects !== 1 ? "s" : ""} recorded.
          </p>
          <button onClick={resetForm} style={{
            width: "100%", padding: 13, background: "#1D9E75",
            border: "none", borderRadius: 8, color: "#fff",
            fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}>
            Submit Another Report
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Defect Report</title></Helmet>
      <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Defect Report</h1>
        <p style={{ color: "#666", marginBottom: 20, fontSize: 14 }}>Report defects found during production.</p>

        {!selectedName ? (
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 }}>
              Select your name to get started
            </label>
            <select
              value={selectedName}
              onChange={e => setSelectedName(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }}
            >
              <option value="">Select your name…</option>
              {foremen.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20, padding: "10px 14px",
              background: "#f0faf6", border: "0.5px solid #1D9E75", borderRadius: 8,
            }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#0F6E56" }}>{selectedName}</span>
              <button onClick={() => setSelectedName("")} style={{ background: "none", border: "none", fontSize: 12, color: "#888", cursor: "pointer", fontFamily: "inherit" }}>
                Change ↩
              </button>
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              padding: "10px 14px", background: "#f0faf6",
              border: "0.5px solid #1D9E75", borderRadius: 8,
            }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56", whiteSpace: "nowrap" }}>Week starting</label>
              <input
                type="date"
                value={weekStart}
                onChange={e => setWeekStart(e.target.value)}
                style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" }}
              />
              <span style={{ fontSize: 12, color: "#888" }}>All entries saved under this week</span>
            </div>

            <form onSubmit={handleSubmit}>
              {workOrderRows.map(wo => (
                <div key={wo.rowId} style={{ border: "0.5px solid #eee", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>

                  {/* Work order header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fafafa", borderBottom: "0.5px solid #eee" }}>
                    <input
                      type="text"
                      maxLength={6}
                      value={wo.workOrderNum}
                      onChange={e => updateWorkOrderField(wo.rowId, "workOrderNum", e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="Work order #"
                      style={{ ...inputStyle, width: 130 }}
                    />
                    <select
                      value={wo.truckTypeId}
                      onChange={e => updateWorkOrderField(wo.rowId, "truckTypeId", e.target.value)}
                      style={{ ...inputStyle, width: 140 }}
                    >
                      <option value="">Truck type…</option>
                      {truckTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, background: "#E6F1FB", color: "#0C447C", padding: "2px 8px", borderRadius: 8 }}>
                      {defectRowTotal(wo.defects)} defects
                    </span>
                    {workOrderRows.length > 1 && (
                      <button type="button" onClick={() => removeWorkOrderRow(wo.rowId)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Defect rows for this work order */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                        <th style={{ padding: "6px 14px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11 }}>Defect type</th>
                        <th style={{ padding: "6px 14px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11, width: 90 }}>Quantity</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wo.defects.map(d => (
                        <tr key={d.rowId} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                          <td style={{ padding: "6px 14px" }}>
                            <select
                              value={d.defectTypeId}
                              onChange={e => updateDefectField(wo.rowId, d.rowId, "defectTypeId", e.target.value)}
                              style={{ ...inputStyle, width: "100%" }}
                            >
                              <option value="">Select defect type…</option>
                              {defectTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "6px 14px" }}>
                            <input
                              type="number"
                              min="0"
                              value={d.quantity}
                              onChange={e => updateDefectField(wo.rowId, d.rowId, "quantity", e.target.value)}
                              placeholder="0"
                              style={{ ...inputStyle, width: 70 }}
                            />
                          </td>
                          <td style={{ padding: "6px 14px" }}>
                            {wo.defects.length > 1 && (
                              <button type="button" onClick={() => removeDefectRow(wo.rowId, d.rowId)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#aaa" }}>
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button
                    type="button"
                    onClick={() => addDefectRow(wo.rowId)}
                    style={{ margin: "8px 14px", padding: "4px 10px", fontSize: 11, border: "0.5px dashed #ddd", borderRadius: 6, background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    + add defect type
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addWorkOrderRow}
                style={{ width: "100%", padding: "8px", fontSize: 12, border: "0.5px dashed #ddd", borderRadius: 8, background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}
              >
                + add another work order
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "0.5px solid #eee" }}>
                <span style={{ fontSize: 12, color: "#888" }}>
                  {readyCount === 0
                    ? "Complete work order # and truck type to submit"
                    : `${readyCount} work order${readyCount !== 1 ? "s" : ""} · ${totalDefects} defects`}
                </span>
                <button
                  type="submit"
                  disabled={readyCount === 0 || saving}
                  style={{
                    padding: "8px 20px",
                    background: readyCount > 0 && !saving ? "#1D9E75" : "#ccc",
                    color: "#fff", border: "none", borderRadius: 8,
                    fontSize: 13, fontWeight: 500,
                    cursor: readyCount > 0 ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  {saving ? "Submitting…" : `Submit ${readyCount > 0 ? readyCount : ""} Work Order${readyCount !== 1 ? "s" : ""}`}
                </button>
              </div>
              {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
            </form>
          </>
        )}
      </main>
    </>
  );
}