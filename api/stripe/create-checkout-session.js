const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { items = [], successUrl, cancelUrl } = req.body || {};
    const line_items = items.map((it) => ({
      price_data: {
        currency: 'dkk',
        product_data: { name: (it.title || 'Vare').slice(0, 120) },
        unit_amount: Math.round(Number(it.price) * 100)
      },
      quantity: Math.max(1, Number(it.qty || 1))
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: successUrl || `${process.env.BASE_URL}/index.html?paid=stripe-success`,
      cancel_url: cancelUrl || `${process.env.BASE_URL}/index.html?paid=stripe-cancel`,
      shipping_address_collection: { allowed_countries: ['DK', 'SE', 'NO', 'DE'] },
      phone_number_collection: { enabled: true }
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Stripe session failed' });
  }
};
