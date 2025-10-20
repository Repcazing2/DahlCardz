const paypal = require('@paypal/checkout-server-sdk');

function client() {
  const isLive = process.env.PAYPAL_MODE === 'live';
  const env = isLive
    ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
    : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
  return new paypal.core.PayPalHttpClient(env);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { items = [] } = req.body || {};
    const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty || 1), 0);

    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'DKK', value: total.toFixed(2) }
      }]
    });

    const resp = await client().execute(request);
    res.status(200).json({ id: resp.result.id });
  } catch (err) {
    console.error('PayPal create error:', err);
    res.status(500).json({ error: 'PayPal order failed' });
  }
};
