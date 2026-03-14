import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const formatNumber = (num) => {
  if (num == null) return '0';
  return Number(num).toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export default function SharedReconciliation() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);

  // Response form state
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [respondentName, setRespondentName] = useState('');
  const [disputeNote, setDisputeNote] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchAct();
  }, [token]);

  const fetchAct = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/shared/reconciliation/${token}`);
      setData(res.data.data);
    } catch (err) {
      if (err.response?.status === 410) {
        setExpired(true);
      } else {
        setError('Hujjat topilmadi yoki havola noto\'g\'ri.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (action) => {
    if (!respondentName.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        action,
        name: respondentName.trim(),
      };
      if (action === 'dispute') {
        payload.note = disputeNote.trim();
        if (disputeAmount) {
          payload.amount = parseFloat(disputeAmount);
        }
      }
      await axios.post(`${API_BASE_URL}/shared/reconciliation/${token}/respond`, payload);
      setSubmitted(true);
      setShowConfirmForm(false);
      setShowDisputeForm(false);
      fetchAct();
    } catch (err) {
      if (err.response?.status === 410) {
        setExpired(true);
      } else {
        alert(err.response?.data?.error || 'Xatolik yuz berdi');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loadingSpinner} />
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.logo}>GENIX ERP</h1>
          </div>
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#9202;</div>
            <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>Havola muddati tugagan</h2>
            <p style={{ color: '#6b7280' }}>
              Bu havola 24 soat davomida amal qilgan. Iltimos, hamkordan yangi havola so'rang.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.logo}>GENIX ERP</h1>
          </div>
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>Xatolik</h2>
            <p style={{ color: '#6b7280' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const responseStatus = data.response_status;
  const canRespond = data.can_respond && !submitted;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.logo}>GENIX ERP</h1>
          <p style={styles.headerSubtitle}>Akt sverka</p>
        </div>

        {/* Partner & Period Info */}
        <div style={styles.infoSection}>
          <h2 style={styles.partnerName}>{data.partner_name}</h2>
          <p style={styles.periodText}>
            Davr: {data.period_start} &mdash; {data.period_end}
          </p>
        </div>

        {/* Response Status Banner */}
        {responseStatus && (
          <div style={{
            ...styles.statusBanner,
            ...(responseStatus === 'confirmed' ? styles.statusConfirmed :
                responseStatus === 'disputed' ? styles.statusDisputed :
                styles.statusPending)
          }}>
            {responseStatus === 'confirmed' && 'Tasdiqlangan'}
            {responseStatus === 'disputed' && 'Bahsli — norozilik bildirilgan'}
            {responseStatus === 'no_response' && 'Javob kutilmoqda'}
          </div>
        )}

        {submitted && (
          <div style={{ ...styles.statusBanner, ...styles.statusConfirmed }}>
            Javobingiz muvaffaqiyatli qabul qilindi!
          </div>
        )}

        {/* Transaction Lines Table */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>No</th>
                <th style={{ ...styles.th, width: '100px' }}>Sana</th>
                <th style={styles.th}>Hujjat</th>
                <th style={styles.th}>Tavsif</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Debet</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Kredit</th>
              </tr>
            </thead>
            <tbody>
              {data.lines && data.lines.length > 0 ? (
                data.lines.map((line, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trEven : {}}>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{i + 1}</td>
                    <td style={styles.td}>{line.date}</td>
                    <td style={styles.td}>{line.document}</td>
                    <td style={styles.td}>{line.description}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {line.debit > 0 ? formatNumber(line.debit) : ''}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {line.credit > 0 ? formatNumber(line.credit) : ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ ...styles.td, textAlign: 'center', color: '#9ca3af' }}>
                    Operatsiyalar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div style={styles.summarySection}>
          <div style={styles.summaryRow}>
            <span>Davr boshi qoldiq:</span>
            <span style={styles.summaryValue}>{formatNumber(data.opening_balance)} so'm</span>
          </div>
          <div style={styles.summaryRow}>
            <span>Jami debet:</span>
            <span style={styles.summaryValue}>{formatNumber(data.our_debit_total)} so'm</span>
          </div>
          <div style={styles.summaryRow}>
            <span>Jami kredit:</span>
            <span style={styles.summaryValue}>{formatNumber(data.our_credit_total)} so'm</span>
          </div>
          <div style={{ ...styles.summaryRow, ...styles.summaryTotal }}>
            <span>Davr oxiri qoldiq:</span>
            <span style={{ ...styles.summaryValue, fontWeight: '700', fontSize: '18px' }}>
              {formatNumber(data.closing_balance)} so'm
            </span>
          </div>
          {data.closing_balance > 0 && (
            <p style={styles.balanceNote}>
              &#8592; siz bizga qarzdorsiz
            </p>
          )}
          {data.closing_balance < 0 && (
            <p style={styles.balanceNote}>
              &#8592; biz sizga qarzdormiz
            </p>
          )}
        </div>

        {/* Dispute Amount Info */}
        {data.dispute_amount != null && responseStatus === 'disputed' && (
          <div style={styles.disputeInfo}>
            <strong>Kontragent ko'rsatgan summa:</strong> {formatNumber(data.dispute_amount)} so'm
          </div>
        )}

        {/* Response Forms */}
        {canRespond && !showConfirmForm && !showDisputeForm && (
          <div style={styles.actionsSection}>
            <p style={styles.actionsLabel}>Vakil FIO kiriting va javob bering:</p>
            <div style={styles.nameInputWrapper}>
              <input
                type="text"
                placeholder="Vakil FIO (majburiy)"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.buttonRow}>
              <button
                onClick={() => {
                  if (!respondentName.trim()) { alert('Iltimos, FIO kiriting'); return; }
                  handleSubmit('confirm');
                }}
                disabled={submitting}
                style={styles.confirmBtn}
              >
                Tasdiqlash — roziman
              </button>
              <button
                onClick={() => {
                  if (!respondentName.trim()) { alert('Iltimos, FIO kiriting'); return; }
                  setShowDisputeForm(true);
                }}
                disabled={submitting}
                style={styles.disputeBtn}
              >
                Bahsli — rozi emasman
              </button>
            </div>
          </div>
        )}

        {/* Dispute Details Form */}
        {showDisputeForm && (
          <div style={styles.actionsSection}>
            <h3 style={{ marginBottom: '12px', color: '#dc2626' }}>Norozilik sababi</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={styles.label}>Sizning hisob-kitobingiz bo'yicha qoldiq (ixtiyoriy):</label>
              <input
                type="number"
                placeholder="Masalan: 8000000"
                value={disputeAmount}
                onChange={(e) => setDisputeAmount(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>Izoh:</label>
              <textarea
                placeholder="Norozilik sababi..."
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                rows={3}
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </div>
            <div style={styles.buttonRow}>
              <button
                onClick={() => setShowDisputeForm(false)}
                style={styles.cancelBtn}
              >
                Bekor qilish
              </button>
              <button
                onClick={() => handleSubmit('dispute')}
                disabled={submitting}
                style={styles.disputeBtn}
              >
                {submitting ? 'Yuborilmoqda...' : 'Norozilik yuborish'}
              </button>
            </div>
          </div>
        )}

        {/* Expiry notice */}
        {data.share_expires_at && (
          <p style={styles.expiryNote}>
            Bu havola {new Date(data.share_expires_at).toLocaleString('uz-UZ')} gacha amal qiladi
          </p>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <p>Genix ERP &middot; genixerp.com</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '24px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '900px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '24px',
    textAlign: 'center',
  },
  logo: {
    color: '#fff',
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    letterSpacing: '1px',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    margin: '4px 0 0',
    fontSize: '14px',
  },
  infoSection: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
  },
  partnerName: {
    margin: '0 0 4px',
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
  },
  periodText: {
    margin: 0,
    color: '#6b7280',
    fontSize: '14px',
  },
  statusBanner: {
    padding: '10px 24px',
    fontWeight: '600',
    fontSize: '14px',
    textAlign: 'center',
  },
  statusConfirmed: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusDisputed: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
  },
  statusPending: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  tableWrapper: {
    overflowX: 'auto',
    padding: '0 24px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    marginTop: '16px',
  },
  th: {
    padding: '10px 8px',
    textAlign: 'left',
    borderBottom: '2px solid #e5e7eb',
    color: '#374151',
    fontWeight: '600',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #f3f4f6',
    color: '#374151',
  },
  trEven: {
    backgroundColor: '#f9fafb',
  },
  summarySection: {
    padding: '16px 24px 20px',
    borderTop: '2px solid #e5e7eb',
    margin: '0 24px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: '14px',
    color: '#374151',
  },
  summaryValue: {
    fontWeight: '500',
    fontVariantNumeric: 'tabular-nums',
  },
  summaryTotal: {
    borderTop: '2px solid #111827',
    marginTop: '8px',
    paddingTop: '12px',
    fontSize: '16px',
    fontWeight: '600',
  },
  balanceNote: {
    color: '#6b7280',
    fontSize: '13px',
    textAlign: 'right',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  disputeInfo: {
    margin: '0 24px 16px',
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#991b1b',
  },
  actionsSection: {
    padding: '20px 24px',
    borderTop: '1px solid #e5e7eb',
    margin: '0',
  },
  actionsLabel: {
    margin: '0 0 12px',
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },
  nameInputWrapper: {
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '500',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  confirmBtn: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    minWidth: '180px',
  },
  disputeBtn: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    minWidth: '180px',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    minWidth: '120px',
  },
  expiryNote: {
    padding: '8px 24px 16px',
    color: '#9ca3af',
    fontSize: '12px',
    textAlign: 'center',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '12px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '40px auto',
  },
};
