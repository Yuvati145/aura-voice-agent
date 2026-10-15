// Mock order database + deterministic business rules.
// Eligibility is computed in code (not by the LLM) so policy answers can't be hallucinated.
const ORDERS = {
  'ORD-101': { order_id: 'ORD-101', customer_first_name: 'Priya', items: ['Vitamin C Serum (30ml)'], value_inr: 699,
    status: 'Out for Delivery', carrier: 'BlueDart', tracking_id: 'BD-982103', note: 'Expected by 6 PM today' },
  'ORD-102': { order_id: 'ORD-102', customer_first_name: 'Rahul', items: ['Hydrating Sunscreen SPF 50'], value_inr: 499,
    status: 'Delivered', carrier: 'Delhivery', tracking_id: 'DL-441029', delivered_days_ago: 14 },
  'ORD-103': { order_id: 'ORD-103', customer_first_name: 'Ananya', items: ['Green Tea Face Wash', 'Toner'], value_inr: 850,
    status: 'Processing', ordered_hours_ago: 3 },
};

const DIGIT_WORDS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

// "ORD 101", "ord one zero one", "ord-101" -> "ORD-101". Returns null if no digits found.
function normalizeOrderId(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => DIGIT_WORDS[w]);
  const digits = s.replace(/\D/g, '');
  return digits ? `ORD-${digits}` : null;
}

function returnEligibility(o) {
  if (o.status !== 'Delivered') return { return_eligible: false, reason: 'Order has not been delivered yet, so a return does not apply.' };
  const inWindow = o.delivered_days_ago <= 7;
  return {
    return_window_ok: inWindow,
    damage_report_window_ok: o.delivered_days_ago * 24 <= 48,
    // Never a final yes here: also needs unopened/unused/original packaging, which only the customer can confirm.
    return_eligible: false,
    reason: inWindow
      ? 'Within the 7-day window. Eligible ONLY if the product is unopened, unused and in original packaging - ask the customer.'
      : `Delivered ${o.delivered_days_ago} days ago, outside the 7-day return window. Not eligible for return. Damaged/defective claims also had to be reported within 48 hours of delivery.`,
  };
}

function getOrderDetails(rawId) {
  const id = normalizeOrderId(rawId);
  if (!id) return { found: false, error: 'No valid order ID was provided. Ask the customer for it (format ORD- followed by 3 digits).' };
  const o = ORDERS[id];
  if (!o) return { found: false, order_id: id, error: `No order found with ID ${id}. Ask the customer to repeat or verify the ID.` };
  return { found: true, ...o, cancellable: o.status === 'Processing', ...(o.status === 'Delivered' ? { return_info: returnEligibility(o) } : {}) };
}

function checkReturnEligibility(rawId) {
  const d = getOrderDetails(rawId);
  return d.found ? { found: true, order_id: d.order_id, status: d.status, ...returnEligibility(d) } : d;
}

// Mock action: sample data is read-only (serverless is stateless), so this validates and confirms only.
function cancelOrder(rawId) {
  const d = getOrderDetails(rawId);
  if (!d.found) return d;
  if (d.status !== 'Processing') {
    return { success: false, order_id: d.order_id, status: d.status,
      reason: `Cannot cancel: status is ${d.status}. Cancellation is only possible while Processing.` +
        (['Shipped', 'Out for Delivery'].includes(d.status) ? ' Customer may refuse delivery at the doorstep.' : '') };
  }
  return { success: true, order_id: d.order_id, message: 'Cancellation request accepted for this Processing order.' };
}

module.exports = { ORDERS, normalizeOrderId, getOrderDetails, checkReturnEligibility, cancelOrder };
