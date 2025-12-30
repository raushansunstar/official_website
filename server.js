// app.js or index.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import fileUpload from "express-fileupload";

import axios from 'axios'; // Import axios to make external requests
import fs from 'fs'; // Add this for directory creation
import adminRoutes from './routes/adminRoutes.js';
import hotelRoutes from './routes/ImageUpload.js';
import instagramRoutes from './routes/instagramRoutes.js';
import ezeeRoutes from './routes/ezeeRoutes.js';
import websiteDataRoutes from './routes/websiteDataRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import enquieryFormRoute from './routes/enquieryFormRoute.js';
import locationRoutes from './routes/locationRoutes.js';
import connectDB from './config/db.js';
import dealRoutes from './routes/dealRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import blogRoutes2 from './routes/blogRoutes2.js';
import metaRoutes from './routes/metaRoutes.js';
import createBooking from './routes/createBookingRoute.js';
import faqRoutes from './routes/faqRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import jobPostRoutes from './routes/jobPostRoutes.js';
import userRoutes from './routes/userRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';
import venueRoutes from './routes/venueRoutes.js';
import authRoutes from './routes/authRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import venueLocation from './routes/venueLocation.js';
import dealStatsRoutes from './routes/dealStatsRoutes.js';
import policyRoutes from './routes/policyRoutes.js';
import careerRoutes from './routes/careerRoutes.js';
import travelAgentRoutes from './routes/travelAgentRoutes.js';
import eventPageRoutes from './routes/eventPageRoutes.js';
import loyaltyProgramRoutes from './routes/loyaltyProgramRoutes.js';
import tourandtravelcontentroutes from './routes/tourandtravelcontentroutes.js';
import digitalAssetRoutes from './routes/digitalAssetRoutes.js';
import diningRoutes from './routes/diningRoutes.js';

import { pushBooking, getBookingList } from './controllers/pushBookingController.js';

dotenv.config();

const app = express();
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }));


// Trust proxy for proper HTTPS detection
app.set('trust proxy', true);

// app.use(cors({
//   origin: [
//     'http://localhost:5173',
//     'https://sunstarhospitality.com',
//     'https://www.sunstarhospitality.com',
//     'http://sunstarhospitality.com',
//     'http://www.sunstarhospitality.com'
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.set('etag', false);

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Create uploads directory in root at startup
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('✅ Uploads directory created at:', UPLOADS_DIR);
  }
} catch (error) {
  console.error('Error creating uploads directory:', error);
}

// Connect to the database
(async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB successfully ');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
})();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      message: 'Database Error',
      error: err.message
    });
  }

  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message
  });
});

app.post('/api/booking', async (req, res) => {
  const { roomData, hotelDetail } = req.body;

  // Validate required fields
  if (!hotelDetail?.hotelCode || !hotelDetail?.authKey) {
    return res.status(400).json({ message: 'Missing hotel details' });
  }

  if (!roomData?.Room_Details || !roomData?.check_in_date || !roomData?.check_out_date || !roomData?.Email_Address) {
    return res.status(400).json({ message: 'Missing required booking information' });
  }

  try {
    const apiUrl = `https://live.ipms247.com/booking/reservation_api/listing.php`;
    const params = {
      request_type: 'InsertBooking',
      HotelCode: hotelDetail.hotelCode,
      APIKey: hotelDetail.authKey,
      BookingData: JSON.stringify(roomData)
    };

    const response = await axios.get(apiUrl, { params });

    if (response.data && response.data.ReservationNo) {
      res.json(response.data);
    } else {
      console.error('eZee API error:', response.data);
      res.status(400).json({
        message: 'Booking failed',
        error: response.data
      });
    }
  } catch (error) {
    console.error('Error making booking request:', error);

    res.status(500).json({
      message: 'Failed to make booking. Please try again.',
      error: error.response?.data || error.message
    });
  }
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/images', hotelRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/ezee', ezeeRoutes);
app.use('/api/websiteData', websiteDataRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/enquiries', enquieryFormRoute);
app.use('/api/locations', locationRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/newBooking', createBooking);
app.use('/api/faqs', faqRoutes);
app.use('/api', packageRoutes);
app.use("/api/jobs", jobPostRoutes);
app.use('/api/blogs2', blogRoutes2);
app.use('/api/user', userRoutes);
app.use('/api/push-booking', pushBooking);
app.get('/api/seemybookings', getBookingList);
app.use('/api/testimonials', testimonialRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/agents", authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/venue-locations', venueLocation);
app.use("/api/dev-owners-stats", dealStatsRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/careers', careerRoutes);
app.use('/api/travel-agent', travelAgentRoutes);
app.use('/api/event-pages', eventPageRoutes);
app.use('/api/loyalty', loyaltyProgramRoutes);
app.use('/api/tourandtravel', tourandtravelcontentroutes);
app.use('/api/digital-assets', digitalAssetRoutes);
app.use('/api/dining', diningRoutes);

// Media upload API routes
app.use("/api/media", mediaRoutes);

// Serve static uploaded files (PDFs, images, documents) from uploads directory
app.use("/api/media", express.static(UPLOADS_DIR));

// Legacy media path for build assets
app.use("/media", express.static(path.join(__dirname, "build", "public", "media")));

// ✅ API mount

// Serve static files
app.use(express.static(path.join(__dirname, 'build')));

// Catch-all for React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on ports ${PORT}`);
  console.log(`Media files served from: ${UPLOADS_DIR}`);
});