// src/controllers/agentController.js
import { validationResult } from "express-validator";
import nodemailer from "nodemailer";
import { Agent } from "../models/Agent.js";
import User from "../models/User.js";
import { syncUserToSheet } from '../utils/sheetSync.js';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// (You can keep needsApproval, but we won’t use it to auto-approve anymore)
// const needsApproval = ...

// Helpers
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const otpExpiry = () => new Date(Date.now() + 10 * 60 * 1000);
const prettyRole = (r) => (r === 'corporate' ? 'Corporate' : 'Agent');

const sendOtpEmail = async ({ to, name, otp, roleTitle }) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Sunstar Group <webmaster@sunstarhospitality.com>',
    to,
    subject: 'Your One-Time Password (OTP)',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:8px;">
        <div style="background:#f5a623;padding:16px;text-align:center;color:#fff;">
          <h2 style="margin:0;">Sunstar Group</h2>
        </div>
        <div style="padding:24px;">
          <p>Hi ${name || 'User'},</p>
          <p>Your OTP for logging in as <b>${roleTitle}</b> is:</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;background:#f5a623;color:#fff;font-size:32px;font-weight:700;padding:12px 24px;border-radius:8px;letter-spacing:5px;">${otp}</span>
          </div>
          <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
          <p style="margin-top:32px;">— Team Sunstar</p>
        </div>
      </div>
    `
  });
};

// 🔔 Admin notification when a new/pending approval arrives
const sendAdminApprovalRequestEmail = async (agent) => {
  const to = process.env.APPROVAL_NOTIFY_TO || process.env.EMAIL_USER;
  if (!to) return;
  const roleTitle = agent.role === "corporate" ? "Corporate Partner" : "Travel Agent";
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Sunstar Group <webmaster@sunstarhospitality.com>',
    to,
    subject: `Approval needed: ${roleTitle} signup (${agent.email})`,
    html: `
      <p>A new ${roleTitle} requires approval.</p>
      <ul>
        <li><b>Name:</b> ${agent.name || '-'}</li>
        <li><b>Email:</b> ${agent.email}</li>
        <li><b>Phone:</b> ${agent.phone || '-'}</li>
        <li><b>Role:</b> ${agent.role}</li>
        <li><b>Created:</b> ${agent.createdAt?.toISOString?.() || new Date().toISOString()}</li>
      </ul>
      <p>Please review and approve in the admin panel.</p>
    `
  });
};

// ✅ Email to user after approval
const sendUserApprovedEmail = async (agent) => {
  const roleTitle = agent.role === "corporate" ? "Corporate Partner" : "Travel Agent";
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Sunstar Group <webmaster@sunstarhospitality.com>',
    to: agent.email,
    subject: `You're approved — Welcome ${roleTitle}!`,
    html: `
      <p>Hi ${agent.name || "User"},</p>
      <p>Your ${roleTitle} account has been <b>approved</b>. You can now access the portal and start booking.</p>
      <p>— Sunstar Team</p>
    `
  });
};

// ✅ Login or register agent/corporate (OTP + no auto-approve)
export const loginAgent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

  const { email, phone, name, role } = req.body;
  const lowerEmail = String(email).toLowerCase();
  const roleTitle = role === "corporate" ? "Corporate Partner" : "Travel Agent";

  try {
    const byPhone = phone ? await Agent.findOne({ phone }) : null;
    const existing = await Agent.findOne({ email: lowerEmail });

    // phone conflict
    if (byPhone && (!existing || String(byPhone._id) !== String(existing._id))) {
      if (byPhone.role && byPhone.role !== role) {
        return res.status(409).json({
          ok: false,
          message: `This phone is already registered as ${prettyRole(byPhone.role)}. `
            + `If you want to switch to ${prettyRole(role)}, please contact admin to delete your current ID.`,
        });
      }
      return res.status(409).json({ ok: false, message: "Phone already in use." });
    }

    // role switch block
    if (existing && existing.role !== role) {
      return res.status(409).json({
        ok: false,
        message: `You are already registered as ${prettyRole(existing.role)}. `
          + `If you want to be ${prettyRole(role)}, please contact admin to delete your current ID.`,
      });
    }

    let agent;
    if (existing) {
      // never change role here
      existing.name = name ?? existing.name;
      if (phone) existing.phone = phone;
      // regenerate OTP
      existing.otp = genOtp();
      existing.otpExpires = otpExpiry();
      await existing.save();
      agent = existing;

      // If still not approved, ping admin (useful for “re-try” flows too)
      if (!agent.approved) {
        try { await sendAdminApprovalRequestEmail(agent); } catch (e) { console.warn("admin notify fail:", e.message); }
      }
    } else {
      // NEW record: ALWAYS pending approval
      agent = await Agent.create({
        name,
        email: lowerEmail,
        phone,
        role,
        approved: false,          // 👈 no auto-approve anymore
        isVerified: false,
        otp: genOtp(),
        otpExpires: otpExpiry(),
      });

      // notify admin about pending approval
      try { await sendAdminApprovalRequestEmail(agent); } catch (e) { console.warn("admin notify fail:", e.message); }
    }

    // send OTP email
    try { await sendOtpEmail({ to: lowerEmail, name, otp: agent.otp, roleTitle }); }
    catch (mailErr) { console.warn("OTP email send failed:", mailErr.message); }

    // Sync to Google Sheet
    syncUserToSheet(agent).catch(err => console.error('Sheet sync error (agent login):', err));

    // More explicit message about approval
    return res.status(202).json({
      ok: true,
      message: "OTP sent to email. After verification, your account will remain pending until an admin approves it. We’ll notify you once approved.",
      data: { email: agent.email, role: agent.role }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "Email or phone already in use.",
        details: err.keyValue
      });
    }
    console.error("loginAgent error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ✅ Verify OTP for agent (approval gate remains)
export const verifyAgentOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const agent = await Agent.findOne({ email: String(email).toLowerCase() });

    if (!agent) return res.status(404).json({ ok: false, message: "Agent not found" });
    if (!agent.otp || !agent.otpExpires || agent.otp !== otp || agent.otpExpires.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: "Invalid or expired OTP" });
    }

    agent.isVerified = true;
    agent.otp = null;
    agent.otpExpires = null;
    await agent.save();

    // ⬇️ was 403 earlier — now send 200 with a flag, so frontend me error na aaye
    if (!agent.approved) {
      return res.status(200).json({
        ok: true,
        pendingApproval: true, // <-- FRONTEND ke liye clear flag
        message: `Your ${agent.role} account is pending approval. We’ll notify you once approved.`,
        data: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          role: agent.role,
          approved: agent.approved,   // false
          isVerified: agent.isVerified // true
        }
      });
    }

    // (Optional) welcome email for verified+approved users
    const roleTitle = agent.role === "corporate" ? "Corporate Partner" : "Travel Agent";
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'Sunstar Group <webmaster@sunstarhospitality.com>',
        to: agent.email,
        subject: `Successfully logged in — Welcome ${roleTitle}!`,
        html: `
          <p>Hi ${agent.name || "User"},</p>
          <p>You are now verified and logged in as a <b>${roleTitle}</b>.</p>
          <p>We're excited to have you onboard.</p>
          <p>— Sunstar Team</p>
        `
      });
    } catch (mailErr) {
      console.warn("Welcome email send failed:", mailErr.message);
    }

    // Sync to Google Sheet (verified status)
    syncUserToSheet(agent).catch(err => console.error('Sheet sync error (agent verify):', err));

    return res.status(200).json({
      ok: true,
      message: "OTP verified. Login successful.",
      data: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        approved: agent.approved,     // true
        isVerified: agent.isVerified  // true
      }
    });
  } catch (err) {
    console.error("verifyAgentOtp error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};


// ✅ Approve agent/corporate (now emails user)
export const approveAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findByIdAndUpdate(id, { $set: { approved: true } }, { new: true });
    if (!agent) return res.status(404).json({ ok: false, message: "Agent not found" });

    // Notify user about approval
    try { await sendUserApprovedEmail(agent); }
    catch (e) { console.warn("user approved email failed:", e.message); }

    return res.status(200).json({ ok: true, message: "Agent approved", data: agent });
  } catch {
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

// List agents/corporates (unchanged)
export const listAgents = async (req, res) => {
  const query = {};
  if (req.query.role) query.role = req.query.role;
  const agents = await Agent.find(query).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, data: agents });
};

export const deleteAgent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

  try {
    const { id } = req.params;
    const deleted = await Agent.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ ok: false, message: "Agent not found" });
    return res.status(200).json({ ok: true, message: "Agent deleted successfully" });
  } catch (err) {
    console.error("deleteAgent error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ✅ Update commission rate for agent
export const updateCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionRate } = req.body;

    // Validate commission rate
    if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 1) {
      return res.status(400).json({
        ok: false,
        message: "Commission rate must be a number between 0 and 1"
      });
    }

    const agent = await Agent.findByIdAndUpdate(
      id,
      { $set: { commissionRate } },
      { new: true, runValidators: true }
    );

    if (!agent) return res.status(404).json({ ok: false, message: "Agent not found" });

    return res.status(200).json({
      ok: true,
      message: "Commission updated successfully",
      data: agent
    });
  } catch (err) {
    console.error("updateCommission error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

// Update total earnings for agent (set directly from frontend calculation)
export const updateEarnings = async (req, res) => {
  try {
    const { email } = req.params;
    const { totalEarnings } = req.body;

    if (typeof totalEarnings !== 'number' || totalEarnings < 0) {
      return res.status(400).json({ ok: false, message: "Invalid totalEarnings value" });
    }

    const agent = await Agent.findOne({ email: email.toLowerCase() });
    if (!agent) {
      return res.status(404).json({ ok: false, message: "Agent not found" });
    }

    agent.totalEarnings = totalEarnings;
    await agent.save();

    return res.status(200).json({
      ok: true,
      message: "Earnings updated successfully",
      totalEarnings: agent.totalEarnings
    });

  } catch (err) {
    console.error("updateEarnings error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};
export const calculateEarnings = async (req, res) => {
  try {
    const { email } = req.params;

    // Get agent details
    const agent = await Agent.findOne({ email: email.toLowerCase() });
    if (!agent) {
      return res.status(404).json({ ok: false, message: "Agent not found" });
    }

    // Find user with this email and get their bookings
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.bookings || user.bookings.length === 0) {
      // No bookings, set earnings to 0
      agent.totalEarnings = 0;
      await agent.save();
      return res.status(200).json({
        ok: true,
        message: "No bookings found, earnings set to 0",
        totalEarnings: 0
      });
    }

    // Calculate total earnings from confirmed bookings
    let totalEarnings = 0;
    const commissionRate = agent.commissionRate || 0.10;

    user.bookings.forEach(booking => {
      // Only count confirmed bookings
      if (booking.status === 'confirmed' && booking.totalAmount) {
        const commission = booking.totalAmount * commissionRate;
        totalEarnings += commission;
      }
    });

    // Update agent's totalEarnings
    agent.totalEarnings = totalEarnings;
    await agent.save();

    return res.status(200).json({
      ok: true,
      message: "Earnings calculated successfully",
      totalEarnings,
      bookingsCount: user.bookings.filter(b => b.status === 'confirmed').length,
      commissionRate
    });

  } catch (err) {
    console.error("calculateEarnings error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};