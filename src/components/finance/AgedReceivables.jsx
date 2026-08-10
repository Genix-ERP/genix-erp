import AgingReport from './AgingReport';

// Kept as its own module so the Financials tab keeps importing the name it
// always has. The screen itself is AgingReport — this file and AgedPayables
// were near-identical copies that had drifted apart in both formatting and
// sign handling.
export default function AgedReceivables() {
  return <AgingReport variant="receivable" />;
}
