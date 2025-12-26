import axios from 'axios';
import qs from 'qs';
import getUserModel from '../models/User.js';

export const pushBooking = async (req, res) => {
  try {
    const { HotelCode, APIKey, BookingData, userEmail, BookingSource } = req.body;
    console.log(BookingData, "booking Data")

    if (!HotelCode || !APIKey || !BookingData || !userEmail) {
      console.warn("❌ Missing fields:", { HotelCode, APIKey, BookingData, userEmail });
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Step 1: InsertBooking API call
    const requestBody = qs.stringify({
      request_type: "InsertBooking",
      HotelCode: HotelCode,
      APIKey: APIKey,
      BookingData: JSON.stringify(BookingData)
    });
    console.log("📦 Request Body for InsertBooking:", requestBody);

    const response = await axios.post(
      'https://live.ipms247.com/booking/reservation_api/listing.php',
      requestBody,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );


    // Safe nested extraction
    const responseData = (response.data?.response ?? response.data) || {};
    console.log("📥 InsertBooking response:", JSON.stringify(responseData, null, 2));
    const { ReservationNo, SubReservationNo, Inventory_Mode, lang_key } = responseData;

    if (!ReservationNo || !SubReservationNo) {
      console.warn("⚠️ ReservationNo or SubReservationNo missing:", responseData);
      return res.status(400).json({ success: false, message: "Invalid booking response from external API" });
    }

    // Step 2: ProcessBooking API call to confirm
    const processData = {
      Action: "ConfirmBooking",
      ReservationNo: ReservationNo,
      Inventory_Mode: Inventory_Mode,
      Error_Text: ""
    };

    const processBookingURL = `https://live.ipms247.com/booking/reservation_api/listing.php?request_type=ProcessBooking&HotelCode=${HotelCode}&APIKey=${APIKey}&Process_Data=${encodeURIComponent(JSON.stringify(processData))}`;

    console.log("📤 ProcessBooking API URL:", processBookingURL);

    const processResponse = await axios.get(processBookingURL);
    console.log("✅ ProcessBooking response:", JSON.stringify(processResponse.data, null, 2));

    // Step 3: Save booking data to MongoDB
    const User = getUserModel;
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.warn("❌ User not found for email:", userEmail);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // SubReservationNo must always be array — bulletproof conversion:
    const subReservations = Array.isArray(SubReservationNo) ? SubReservationNo : [SubReservationNo];

    const newBookingDetails = subReservations.map(subNo => ({
      HotelCode,
      APIKey,
      language: lang_key,
      ResNo: ReservationNo,
      SubNo: subNo,
      BookingType: Inventory_Mode,
      BookingSource: BookingSource || ""
    }));

    console.log("🗃️ BookingDetails to insert:", newBookingDetails);

    user.bookingDetails.push(...newBookingDetails);
    await user.save();
    console.log("✅ BookingDetails saved to DB");

    return res.json({
      success: true,
      message: "Booking pushed & confirmed successfully",
      bookingDetails: newBookingDetails,
      processBookingResponse: processResponse.data
    });

  } catch (error) {
    console.error("💥 Error in pushBooking:", error?.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Booking push failed",
      error: error?.response?.data || error.message
    });
  }
};


export const getBookingList = async (req, res) => {
  try {
    const { hotelCode, email, apiKey } = req.query;

    if (!hotelCode || !email || !apiKey) {
      return res.status(400).json({ error: 'hotelCode, email, and apiKey are required' });
    }

    const url = `https://live.ipms247.com/booking/reservation_api/listing.php?request_type=BookingList&HotelCode=${hotelCode}&APIKey=${apiKey}&arrival_from=&arrival_to=&EmailId=${email}`;

    const response = await axios.get(url);
    const bookingList = response.data.BookingList || [];

    // Fetch local user data to get BookingSource
    const User = getUserModel;
    const user = await User.findOne({ email });
    const localBookings = user ? user.bookingDetails : [];

    // Merge BookingSource into bookingList
    const mergedBookingList = bookingList.map(booking => {
      // Ensure we compare strings to avoid type mismatches (Number vs String)
      const localBooking = localBookings.find(lb => String(lb.ResNo) === String(booking.ReservationNo));
      return {
        ...booking,
        Source: localBooking?.BookingSource || booking.Source || ""
      };
    });

    // --- Persist Total Earnings Logic ---
    if (user) {
      const commissionRate = user.commissionRate || 0.10;

      // Filter for "Agnet" or "Corporate" (assuming we track all earnings, or just filter non-cancelled)
      // Note: The frontend explicitly filters for "Agent" source for AgentDashboard. 
      // Here we will calculate earnings for ALL valid bookings associated with this user that are NOT cancelled.

      const validBookings = mergedBookingList.filter(b => {
        const status = (b.Booking_Status || b.Status || "").toLowerCase();
        return status !== "cancelled" && status !== "failed";
      });

      const totalEarnings = validBookings.reduce((sum, booking) => {
        const amount = parseFloat(booking.TotalInclusiveTax || 0);
        return sum + (amount * commissionRate);
      }, 0);

      // Update DB
      user.totalEarnings = totalEarnings;
      await user.save();
    }
    // ------------------------------------

    res.json({
      ...response.data,
      BookingList: mergedBookingList,
      totalEarnings: user ? user.totalEarnings : 0
    });

  } catch (err) {
    console.error("Error fetching booking list:", err.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};



export const cancelBookingController = async (req, res) => {
  try {
    const { hotelCode, apiKey, reservationNo } = req.body;

    if (!hotelCode || !apiKey || !reservationNo) {
      return res.status(400).json({
        success: false,
        message: "hotelCode, apiKey, and reservationNo are required"
      });
    }

    const url = "https://live.ipms247.com/booking/reservation_api/listing.php";

    const params = {
      request_type: "CancelBooking",
      HotelCode: hotelCode,
      APIKey: apiKey,
      ResNo: reservationNo,
      SubNo: "",
      language: "en"
    };

    const response = await axios.get(url, { params });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: response.data
    });

  } catch (error) {
    console.error("Cancel Booking Error:", error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: error.message
    });
  }
};