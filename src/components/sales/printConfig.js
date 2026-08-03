// Shared company header ("rekvizitlar") for printed sales documents —
// the order print preview (SalesOrders.jsx) and the invoice print form
// (Invoices.jsx) read the same localStorage print-config keys.
//
// Bank rekvizitlari come from the same localStorage config (keys
// `bank_name`, `bank_mfo`, `bank_account`) with the active company's
// stored bank details as fallback; they default to empty strings and
// print templates must render those rows only when non-empty.
export function getPrintCompanyConfig(activeCompany) {
  return {
    name: activeCompany?.company_name || localStorage.getItem('company_name') || 'Genix ERP',
    address: localStorage.getItem('company_address') || "Toshkent, O'zbekiston",
    phone: localStorage.getItem('company_phone') || '+998 XX XXX XX XX',
    email: localStorage.getItem('company_email') || 'info@genix.uz',
    inn: localStorage.getItem('company_inn') || '123456789',
    logo: localStorage.getItem('company_logo') || null,
    bank_name: localStorage.getItem('bank_name') || activeCompany?.bank_name || '',
    bank_mfo: localStorage.getItem('bank_mfo') || activeCompany?.bank_mfo || '',
    bank_account: localStorage.getItem('bank_account') || activeCompany?.bank_account || '',
  };
}

export default getPrintCompanyConfig;
