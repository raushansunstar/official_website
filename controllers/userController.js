// controllers/userController.js

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { syncUserToSheet } from '../utils/sheetSync.js';

dotenv.config();

// Setup email transporter
export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// ✅ Get full user info by email
export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    const emptyData = {
      id: null,
      isVerified: false,
      email: null,
      phone: null,
      firstName: null,
      lastName: null,
      role: null,
      loyalAgent: null,
      bookingDetails: [],
      totalBookings: 0, // count added
      dateOfBirth: null,
      gender: null,
      cityOfResidence: null,
      gstin: null
    };

    if (!email || email.trim() === '') {
      return res.json({
        success: true,
        data: emptyData
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: true,
        data: {
          ...emptyData,
          email // preserve the queried email
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        isVerified: user.isVerified,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        loyalAgent: user.loyalAgent,
        bookingDetails: user.bookingDetails,
        totalBookings: (user.bookingDetails || []).length, // total count
        dateOfBirth: user.dateOfBirth || '',
        gender: user.gender || '',
        cityOfResidence: user.cityOfResidence || '',
        gstin: user.gstin || ''
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Send OTP to email
export const sendOtp2 = async (req, res) => {
  try {
    const { email, phone, firstName, lastName, role, loyalAgent } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    let user = await User.findOne({ email });

    if (!user) {
      // Check if phone number already exists with another user
      if (phone && phone.trim() !== '') {
        const existingPhoneUser = await User.findOne({ phone });
        if (existingPhoneUser) {
          return res.status(400).json({
            success: false,
            message: 'Phone number is already registered with another account'
          });
        }
      }

      try {
        user = await User.create({
          email,
          phone: phone && phone.trim() !== '' ? phone : undefined, // Only set phone if provided
          firstName,
          lastName,
          role,
          loyalAgent,
          otp,
          otpExpires
        });
      } catch (createError) {
        // Handle duplicate key error specifically
        if (createError.code === 11000) {
          if (createError.keyPattern && createError.keyPattern.phone) {
            return res.status(400).json({
              success: false,
              message: 'Phone number is already registered with another account'
            });
          }
          if (createError.keyPattern && createError.keyPattern.email) {
            return res.status(400).json({
              success: false,
              message: 'Email is already registered'
            });
          }
          return res.status(400).json({
            success: false,
            message: 'Account with this information already exists'
          });
        }
        throw createError; // Re-throw if it's not a duplicate key error
      }

      // Sync new user to Google Sheet
      syncUserToSheet(user).catch(err => console.error('Sheet sync error:', err));

    } else {
      // User exists, just update OTP
      user.otp = otp;
      user.otpExpires = otpExpires;

      // Update other fields if provided (but be careful with phone)
      if (phone && phone.trim() !== '' && phone !== user.phone) {
        const existingPhoneUser = await User.findOne({ phone });
        if (existingPhoneUser && existingPhoneUser._id.toString() !== user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Phone number is already registered with another account'
          });
        }
        user.phone = phone;
      }

      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (role) user.role = role;
      if (loyalAgent !== undefined) user.loyalAgent = loyalAgent;

      await user.save();

      // Sync updated user to Google Sheet
      syncUserToSheet(user).catch(err => console.error('Sheet sync error:', err));
    }

    // ✅ Beautiful HTML Email
    const mailOptions = {
      from: 'Sunstar Group <webmaster@sunstarhospitality.com>',
      to: email,
      subject: 'Your One-Time Password (OTP) - Sunstar Group',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #f5a623; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: 1px;">Sunstar Group</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; color: #333333; margin-bottom: 25px;">Hi ${firstName || 'User'},</p>
            
            <p style="font-size: 16px; color: #333333; line-height: 1.5; margin-bottom: 30px;">
              Use the One-Time Password (OTP) below to log in to your account. This code is valid for <strong>10 minutes</strong>.
            </p>
            
            <!-- OTP Box -->
            <div style="text-align: center; margin-bottom: 35px;">
              <div style="display: inline-block; background-color: #fff8e1; border: 2px dashed #f5a623; color: #333333; font-size: 32px; font-weight: 700; padding: 15px 40px; border-radius: 8px; letter-spacing: 6px;">
                ${otp}
              </div>
            </div>

            <!-- Warning Box -->
            <div style="background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>SECURITY WARNING:</strong> Do not share this OTP with anyone, including Sunstar Group staff. We will never ask for your OTP over phone or email.
              </p>
            </div>

            <p style="font-size: 14px; color: #666666; line-height: 1.5;">
              By logging in, you agree to our 
              <a href="https://sunstarhospitality.com/terms-conditions&cancellation" style="color: #f5a623; text-decoration: none; font-weight: 600;">Terms & Conditions</a> 
              and 
              <a href="https://sunstarhospitality.com/privacy-policies" style="color: #f5a623; text-decoration: none; font-weight: 600;">Privacy Policy</a>.
            </p>

            <p style="margin-top: 40px; font-size: 16px; color: #333333;">
              Safe travels,<br>
              <strong>Team Sunstar</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 10px; font-size: 12px; color: #888888;">
              &copy; ${new Date().getFullYear()} Sunstar Group. All rights reserved.
            </p>
            <p style="margin: 0; font-size: 12px; color: #888888;">
              Need help? Contact us at <a href="mailto:webmaster@sunstarhospitality.com" style="color: #f5a623; text-decoration: none;">webmaster@sunstarhospitality.com</a>
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'OTP sent successfully' });

  } catch (err) {
    console.error('Error in sendOtp2:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// Verify OTP
export const verifyOtp2 = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ success: true, message: 'OTP verified successfully', user });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Add Booking Details (Multiple)
export const addBookingDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const bookingData = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.bookingDetails.push(bookingData);
    await user.save();

    res.json({ success: true, message: 'Booking added successfully', user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Check if user is verified by email
export const checkEmailVerification = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email || email.trim() === '') {
      return res.json({ success: false, verified: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (user && user.isVerified) {
      return res.json({ success: true, verified: true });
    } else {
      return res.json({ success: true, verified: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// ✅ Update User Profile (e.g., DOB, Gender, City, GST, etc.)
export const updateUserProfile = async (req, res) => {
  try {
    const { email } = req.body;
    const updateFields = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required for update' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $set: updateFields },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User updated successfully', user });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const applyForJob = async (req, res) => {
  try {
    // Body fields (frontend FormData se aayenge)
    const {
      name,
      appliedFor,
      phoneNumber,
      emailId,
      gender,
      submittedAt
    } = req.body;

    const file = req.file; // multer.single("resume") se aayega

    // ---- Basic validation ----
    const required = { name, appliedFor, phoneNumber, emailId, gender, submittedAt };
    for (const [k, v] of Object.entries(required)) {
      if (!v || String(v).trim() === '') {
        return res.status(400).json({ success: false, message: `${k} is required` });
      }
    }
    if (!file) return res.status(400).json({ success: false, message: 'resume file is required' });

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Resume must be PDF or Word' });
    }

    // ---- Email #1: Admin/HR ko with attachment ----
    const adminHtml = `
      <h2>New Job Application</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Applied For:</b> ${appliedFor}</p>
      <p><b>Phone:</b> ${phoneNumber}</p>
      <p><b>Email:</b> ${emailId}</p>
      <p><b>Gender:</b> ${gender}</p>
      <p><b>Submitted At:</b> ${new Date(submittedAt).toLocaleString()}</p>
      <p>Resume attached.</p>
    `;

    const adminMail = {
      from: `Sunstar Group <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // .env me set karein
      subject: `New Application: ${name} - ${appliedFor}`,
      html: adminHtml,
      attachments: [
        {
          filename: file.originalname,
          content: file.buffer,      // Multer memory buffer
          contentType: file.mimetype
        }
      ]
    };

    // ---- Email #2: Applicant ko confirmation ----
    const userHtml = `
      <p>Hi ${name},</p>
      <p>Thanks for applying for <b>${appliedFor}</b>. We’ve received your application and will contact you soon.</p>
      <p>Best Regards,<br/>Team Sunstar</p>
    `;
    const userMail = {
      from: `Sunstar Group <${process.env.EMAIL_USER}>`,
      to: emailId,
      subject: `Thanks for applying — ${appliedFor}`,
      html: userHtml
    };

    // Send both emails in parallel
    await Promise.all([
      transporter.sendMail(adminMail),
      transporter.sendMail(userMail)
    ]);


    return res.json({ success: true, message: 'Application received & emails sent' });
  } catch (err) {
    console.error('applyForJob error:', err);
    return res.status(500).json({ success: false, message: 'Server error while applying' });
  }
};
