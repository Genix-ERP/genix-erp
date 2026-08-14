import ContactCombobox from "./ContactCombobox";

// Kept as the customer-shaped entry point into ContactCombobox: SalesOrders and
// Returns already import this name and pass `customers`. Everything the picker
// does — server search over company name, contact person, code, INN, phone —
// lives in ContactCombobox.
export default function CustomerCombobox({
  customers = [],
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
  t = (k) => k,
}) {
  return (
    <ContactCombobox
      type="customer"
      contacts={customers}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      t={t}
    />
  );
}
