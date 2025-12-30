// src/models/Agent.js
import mongoose from "mongoose";
import { validationResult } from "express-validator";

const ROLES = ["agent", "corporate"];

export const getAgentByEmail = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

  const email = String(req.query.email || "").toLowerCase();
  try {
    const agent = await Agent.findOne({ email }).lean();
    if (!agent) return res.status(404).json({ ok: false, message: "Not found" });
    return res.json({ ok: true, data: agent });
  } catch {
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

// Booking details schema (shared with User model)
const bookingDetailsSchema = new mongoose.Schema({
  HotelCode: { type: String },
  APIKey: { type: String },
  language: { type: String },
  ResNo: { type: String },
  SubNo: { type: String },
  BookingType: { type: String },
  BookingSource: { type: String },
  finalPrice: { type: Number, default: 0 }
}, { _id: false });

const agentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, unique: true, index: true },
    phone: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    approved: { type: Boolean, default: true },
    commissionRate: { type: Number, default: 0.10, min: 0, max: 1 },
    totalEarnings: { type: Number, default: 0, min: 0 },
    bookingDetails: [bookingDetailsSchema], // Add booking details storage
    cityOfResidence: { type: String },
    gstNumber: { type: String },
    companyName: { type: String }, // For corporate users

    // 🔽 NEW: email OTP login
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null }
  },
  { timestamps: true }
);

// helpful indexes
agentSchema.index({ email: 1, role: 1 });
agentSchema.index({ phone: 1, role: 1 });

export const Agent = mongoose.model("Agent", agentSchema);
export const ROLES_ENUM = ROLES;
