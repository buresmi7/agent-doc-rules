export function exportInvoices(invoices) {
  return invoices.map((invoice) => [
    invoice.id,
    invoice.customer,
    invoice.total,
  ].join(',')).join('\n');
}
