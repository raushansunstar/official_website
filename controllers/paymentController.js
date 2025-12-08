import razorpayFactory from "../config/razorpayClient.js";
import crypto from "crypto";

export const createOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", receipt, hotelCode } = req.body;

    if (!hotelCode) {
      return res.status(400).json({ error: "Hotel code is required" });
    }

    const razorpay = razorpayFactory(hotelCode);

    const options = {
      amount: Math.round(amount * 100),  // Razorpay requires amount in paise and must be an integer
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error("Error creating Razorpay order:", err);

    if (err.message && err.message.includes("Invalid Razorpay keys")) {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};



export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, hotelCode } = req.body;

    if (!hotelCode) {
      return res.status(400).json({ error: "Hotel code is required" });
    }

    const key_secret = process.env[`RAZORPAY_KEY_SECRET_${hotelCode}`];

    const generatedSignature = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      res.json({ verified: true, message: "Payment verified successfully." });
    } else {
      res.status(400).json({ verified: false, message: "Payment verification failed." });
    }
  } catch (err) {
    console.error("Error verifying payment:", err);
    res.status(500).json({ error: err.message });
  }
};