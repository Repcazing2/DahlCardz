const Stripe = require('stripe');
const { buffer } = require('micro');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  let event;
  try {
    const rawBody = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // TODO: Fulfillment: skriv ordre i DB, send mail, mv.
      console.log('✅ Stripe betalt:', session.id);
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send('server error');
  }
};
