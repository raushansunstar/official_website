// routes/userRoutes.js

import express from 'express';
import { sendOtp2, verifyOtp2, addBookingDetails, getUserByEmail, checkEmailVerification, updateUserProfile, deductEarnings, applyForJob } from '../controllers/userController.js';
import { cancelBookingController } from '../controllers/pushBookingController.js';
import multer from 'multer';

const router = express.Router();

// Multer memory storage (5MB limit)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/get-user', getUserByEmail);
router.get('/check-verification', checkEmailVerification);


router.post('/send-otp', sendOtp2);
router.post('/verify-otp', verifyOtp2);
router.post('/add-booking/:userId', addBookingDetails);

router.post("/cancelBooking", cancelBookingController);
router.put('/update-profile', updateUserProfile);
router.post('/deduct-earnings', deductEarnings); // New route for deducting earnings


router.post('/jobs/apply', upload.single('resume'), applyForJob);



export default router;
