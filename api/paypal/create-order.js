import paypal from "@paypal/paypal-server-sdk";

const client = () => {
  const env =
    process.env.PAYPAL_MODE === "live"
      ? new paypal.core.LiveEnvironment(
          process.env.PAYPAL_CLIENT_ID,
          process.env.PAYPAL_CLIENT_SECRET
        )
      : new paypal.core.SandboxEnvironment(
          process.env.PAYPAL_CLIENT_ID,
          process.env.PAYPAL_CLIENT_SECRET
        );
  return new paypal.core.PayPalHttpClient(env);
};

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { items = [] } = req.body || {};
    const total = items.reduce(
      (sum, it) => sum + Number(it.price) * (Number(it.qty) || 1),
      0
    );

    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "DKK",
            value: total.toFixed(2),
          },
        },
      ],
    });

    const response = await client().execute(request);
    res.status(200).json({ id: response.result.id });
  } catch (err) {
    console.error("PayPal create-order error:", err);
    res.status(500).json({ error: "PayPal create-order failed" });
  }
}
