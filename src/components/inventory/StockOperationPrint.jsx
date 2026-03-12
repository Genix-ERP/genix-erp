import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { format } from 'date-fns';

const styles = {
  page: {
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    color: '#1a1a1a',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #333',
    paddingBottom: '12px',
    marginBottom: '16px',
  },
  title: { fontSize: '18px', fontWeight: 'bold', margin: 0 },
  subtitle: { fontSize: '12px', color: '#666', margin: '4px 0 0' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '12px',
  },
  th: {
    border: '1px solid #ccc',
    padding: '6px 8px',
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    textAlign: 'left',
    fontSize: '11px',
  },
  td: {
    border: '1px solid #ccc',
    padding: '6px 8px',
    fontSize: '11px',
  },
  tdRight: {
    border: '1px solid #ccc',
    padding: '6px 8px',
    fontSize: '11px',
    textAlign: 'right',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '16px',
  },
  infoItem: { display: 'flex', gap: '8px' },
  infoLabel: { fontWeight: 'bold', minWidth: '120px', color: '#555' },
  signatureBlock: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '40px',
    paddingTop: '16px',
  },
  signatureLine: {
    width: '200px',
    borderTop: '1px solid #333',
    paddingTop: '4px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#666',
  },
};

const fmtDate = (d) => d ? format(new Date(d), 'dd.MM.yyyy HH:mm') : '—';
const fmtDateShort = (d) => d ? format(new Date(d), 'dd.MM.yyyy') : '—';

// ─── Picking List ────────────────────────────────────────────────────────────

export function PickingListPrint({ operation }) {
  const op = operation;
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.title}>Picking List</p>
          <p style={styles.subtitle}>{op.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0 }}>{fmtDate(op.date)}</p>
          <p style={{ ...styles.subtitle, textTransform: 'capitalize' }}>{op.state}</p>
        </div>
      </div>

      <div style={styles.infoGrid}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Warehouse:</span>
          <span>{op.warehouse_name || '—'}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Partner:</span>
          <span>{op.partner_name || '—'}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Scheduled:</span>
          <span>{fmtDateShort(op.scheduled_date)}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Source Doc:</span>
          <span>{op.source_document || '—'}</span>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '30px' }}>#</th>
            <th style={styles.th}>Product</th>
            <th style={styles.th}>Code</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Expected</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Done</th>
            <th style={styles.th}>Location</th>
            <th style={styles.th}>Lot</th>
            <th style={{ ...styles.th, width: '60px' }}>Check</th>
          </tr>
        </thead>
        <tbody>
          {(op.lines || []).map((line, i) => (
            <tr key={line.id || i}>
              <td style={styles.td}>{i + 1}</td>
              <td style={styles.td}>{line.product_name}</td>
              <td style={styles.td}>{line.product_code || '—'}</td>
              <td style={styles.tdRight}>{line.expected_qty} {line.uom}</td>
              <td style={styles.tdRight}>{line.done_qty} {line.uom}</td>
              <td style={styles.td}>{line.source_location || line.dest_location || '—'}</td>
              <td style={styles.td}>{line.lot_number || '—'}</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>☐</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={styles.signatureBlock}>
        <div style={styles.signatureLine}>Picker Signature</div>
        <div style={styles.signatureLine}>Supervisor Signature</div>
      </div>
    </div>
  );
}

// ─── Packing Slip ────────────────────────────────────────────────────────────

export function PackingSlipPrint({ operation }) {
  const op = operation;
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.title}>Packing Slip</p>
          <p style={styles.subtitle}>{op.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0 }}>{fmtDate(op.date)}</p>
        </div>
      </div>

      <div style={styles.infoGrid}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Warehouse:</span>
          <span>{op.warehouse_name || '—'}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Customer:</span>
          <span>{op.partner_name || '—'}</span>
        </div>
        {op.carrier_name && (
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Carrier:</span>
            <span>{op.carrier_name}</span>
          </div>
        )}
        {op.tracking_number && (
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Tracking #:</span>
            <span>{op.tracking_number}</span>
          </div>
        )}
        {op.delivery_address && (
          <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
            <span style={styles.infoLabel}>Ship To:</span>
            <span>{op.delivery_address}</span>
          </div>
        )}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '30px' }}>#</th>
            <th style={styles.th}>Product</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Qty</th>
            <th style={styles.th}>UOM</th>
            <th style={styles.th}>Tracking #</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Weight (kg)</th>
            <th style={styles.th}>Dimensions</th>
          </tr>
        </thead>
        <tbody>
          {(op.lines || []).map((line, i) => (
            <tr key={line.id || i}>
              <td style={styles.td}>{i + 1}</td>
              <td style={styles.td}>{line.product_name}</td>
              <td style={styles.tdRight}>{line.done_qty || line.expected_qty}</td>
              <td style={styles.td}>{line.uom}</td>
              <td style={styles.td}>{line.tracking_number || '—'}</td>
              <td style={styles.tdRight}>{line.package_weight || '—'}</td>
              <td style={styles.td}>{line.package_dimensions || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '16px', fontSize: '11px', color: '#666' }}>
        <p>Total items: {(op.lines || []).length}</p>
        <p>Total weight: {(op.lines || []).reduce((sum, l) => sum + (parseFloat(l.package_weight) || 0), 0).toFixed(3)} kg</p>
      </div>

      <div style={styles.signatureBlock}>
        <div style={styles.signatureLine}>Packer Signature</div>
        <div style={styles.signatureLine}>Verified By</div>
      </div>
    </div>
  );
}

// ─── Delivery Note (TTN) ────────────────────────────────────────────────────

export function DeliveryNotePrint({ operation }) {
  const op = operation;
  return (
    <div style={styles.page}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '12px', marginBottom: '16px' }}>
        <p style={{ ...styles.title, fontSize: '20px' }}>ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ (ТТН)</p>
        <p style={{ ...styles.title, fontSize: '16px', marginTop: '4px' }}>YETKAZIB BERISH HUJJATI</p>
        <p style={styles.subtitle}>№ {op.name} — {fmtDate(op.date)}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{ border: '1px solid #ccc', padding: '12px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>Отправитель / Jo'natuvchi</p>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Warehouse:</span>
            <span>{op.warehouse_name || '—'}</span>
          </div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '12px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>Получатель / Qabul qiluvchi</p>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Partner:</span>
            <span>{op.partner_name || '—'}</span>
          </div>
          {op.delivery_address && (
            <div style={{ ...styles.infoItem, marginTop: '4px' }}>
              <span style={styles.infoLabel}>Address:</span>
              <span>{op.delivery_address}</span>
            </div>
          )}
        </div>
      </div>

      {op.carrier_name && (
        <div style={{ border: '1px solid #ccc', padding: '12px', marginBottom: '16px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>Перевозчик / Tashuvchi</p>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Carrier:</span>
              <span>{op.carrier_name}</span>
            </div>
            {op.tracking_number && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Tracking #:</span>
                <span>{op.tracking_number}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '30px' }}>#</th>
            <th style={styles.th}>Наименование / Nomi</th>
            <th style={styles.th}>Код / Code</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Кол-во / Soni</th>
            <th style={styles.th}>Ед.изм / Birlik</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Вес / Og'irlik (kg)</th>
            <th style={styles.th}>Партия / Lot</th>
          </tr>
        </thead>
        <tbody>
          {(op.lines || []).map((line, i) => (
            <tr key={line.id || i}>
              <td style={styles.td}>{i + 1}</td>
              <td style={styles.td}>{line.product_name}</td>
              <td style={styles.td}>{line.product_code || '—'}</td>
              <td style={styles.tdRight}>{line.done_qty || line.expected_qty}</td>
              <td style={styles.td}>{line.uom}</td>
              <td style={styles.tdRight}>{line.package_weight || '—'}</td>
              <td style={styles.td}>{line.lot_number || '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...styles.td, fontWeight: 'bold' }} colSpan={3}>Итого / Jami</td>
            <td style={{ ...styles.tdRight, fontWeight: 'bold' }}>
              {(op.lines || []).reduce((s, l) => s + (l.done_qty || l.expected_qty || 0), 0)}
            </td>
            <td style={styles.td}></td>
            <td style={{ ...styles.tdRight, fontWeight: 'bold' }}>
              {(op.lines || []).reduce((s, l) => s + (parseFloat(l.package_weight) || 0), 0).toFixed(3)}
            </td>
            <td style={styles.td}></td>
          </tr>
        </tfoot>
      </table>

      {op.note && (
        <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', fontSize: '11px' }}>
          <strong>Примечание / Izoh:</strong> {op.note}
        </div>
      )}

      <div style={{ ...styles.signatureBlock, justifyContent: 'space-around' }}>
        <div style={styles.signatureLine}>Отправил / Jo'natdi</div>
        <div style={styles.signatureLine}>Перевозчик / Tashuvchi</div>
        <div style={styles.signatureLine}>Принял / Qabul qildi</div>
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '10px', color: '#999' }}>
        Дата печати / Chop etilgan sana: {format(new Date(), 'dd.MM.yyyy HH:mm')}
      </div>
    </div>
  );
}

// ─── Print Handler ───────────────────────────────────────────────────────────

export function printDocument(component) {
  const html = ReactDOMServer.renderToStaticMarkup(component);
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print</title>
        <style>
          @media print {
            body { margin: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
