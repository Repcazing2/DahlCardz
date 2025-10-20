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
    const { orderId } = req.body || {};
    if (!orderId)
      return res.status(400).json({ error: "Missing orderId" });

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    const capture = await client().execute(request);

    console.log("✅ PayPal captured:", capture.result.id);
    res.status(200).json({ capture: capture.result });
  } catch (err) {
    console.error("PayPal capture-order error:", err);
    res.status(500).json({ error: "PayPal capture-order failed" });
  }
}
