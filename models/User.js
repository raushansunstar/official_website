import mongoose from "mongoose";

const bookingDetailsSchema = new mongoose.Schema({
  HotelCode: { type: String },
  APIKey: { type: String },
  language: { type: String },
  ResNo: { type: String },
  SubNo: { type: String },
  BookingType: { type: String },
  BookingSource: { type: String }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: {
    type: String,
    // Remove unique constraint if you want to allow duplicate phone numbers
    // unique: true,
    sparse: true,
    validate: {
      validator: function (v) {
        if (!v) return true; // allow empty
        // Must be digits only and exactly 10 digits
        return /^[0-9]{10}$/.test(v);
      },
      message: () => `Please enter a valid 10-digit phone number`
    }
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: {
    type: String,
    enum: ["user", "travelAgent", "coorporateAgent"],
    default: "user"
  },
  dateOfBirth: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''] },
  cityOfResidence: { type: String },
  loyalAgent: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  commissionRate: { type: Number, default: 0.10 }, // Default 10% commission
  bookingDetails: [bookingDetailsSchema]
}, { timestamps: true });

export const getModel = (modelName, schema) => {
  return mongoose.models[modelName] || mongoose.model(modelName, schema);
}

export default getModel("User", userSchema);