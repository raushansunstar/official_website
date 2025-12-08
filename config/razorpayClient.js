import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config();

const razorpayFactory = (hotelCode) => {
  const key_id = process.env[`RAZORPAY_KEY_ID_${hotelCode}`];
  const key_secret = process.env[`RAZORPAY_KEY_SECRET_${hotelCode}`];

  if (!key_id || !key_secret) {
    console.error(`Error: Missing keys for hotelCode ${hotelCode}`);
    throw new Error(`Invalid Razorpay keys for hotelCode: ${hotelCode}`);
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
};

export default razorpayFactory;
