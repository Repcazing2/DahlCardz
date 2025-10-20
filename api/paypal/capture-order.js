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
    const { orderId } = req.body || {};
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    const capture = await client().execute(request);

    // TODO: Fulfillment — skriv ordre i DB, send kvittering osv.
    res.status(200).json({ capture: capture.result });
  } catch (err) {
    console.error('PayPal capture error:', err);
    res.status(500).json({ error: 'PayPal capture failed' });
  }
};
