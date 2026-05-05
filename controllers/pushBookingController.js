import axios from 'axios';
import qs from 'qs';
import getUserModel from '../models/User.js';
import Hotel from '../models/Hotel.js';
import { Agent } from '../models/Agent.js';

export const pushBooking = async (req, res) => {
  try {
    const { HotelCode, APIKey, BookingData, userEmail, BookingSource, BookedBy, finalPrice } = req.body;
    console.log(BookingData, "booking Data")

    let resolvedAPIKey = APIKey;
    if (!resolvedAPIKey && HotelCode) {
      const numericHotelCode = Number(HotelCode);
      const filter = Number.isFinite(numericHotelCode) && !Number.isNaN(numericHotelCode)
        ? { hotelCode: numericHotelCode }
        : { hotelCode: HotelCode };
      const hotel = await Hotel.findOne(filter, { authKey: 1 }).lean();
      resolvedAPIKey = hotel?.authKey || null;
    }

    if (!HotelCode || !resolvedAPIKey || !BookingData || !userEmail) {
      console.warn("❌ Missing fields:", { HotelCode, APIKey: resolvedAPIKey, BookingData, userEmail });
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Step 1: InsertBooking API call
    const requestBody = qs.stringify({
      request_type: "InsertBooking",
      HotelCode: HotelCode,
      APIKey: resolvedAPIKey,
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

    const processBookingURL = `https://live.ipms247.com/booking/reservation_api/listing.php?request_type=ProcessBooking&HotelCode=${HotelCode}&APIKey=${resolvedAPIKey}&Process_Data=${encodeURIComponent(JSON.stringify(processData))}`;

    console.log("📤 ProcessBooking API URL:", processBookingURL);

    const processResponse = await axios.get(processBookingURL);
    console.log("✅ ProcessBooking response:", JSON.stringify(processResponse.data, null, 2));

    // Step 3: Save booking data to MongoDB
    // Try Agent collection first (for corporate/agent users)
    let user = await Agent.findOne({ email: userEmail });
    let isAgent = true;

    // If not found in Agent, try User collection
    if (!user) {
      const User = getUserModel;
      user = await User.findOne({ email: userEmail });
      isAgent = false;
    }

    if (!user) {
      console.warn("❌ User not found in any collection for email:", userEmail);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // SubReservationNo must always be array — bulletproof conversion:
    const subReservations = Array.isArray(SubReservationNo) ? SubReservationNo : [SubReservationNo];

    const newBookingDetails = subReservations.map(subNo => ({
      HotelCode,
      APIKey: resolvedAPIKey,
      language: lang_key,
      ResNo: ReservationNo,
      SubNo: subNo,
      BookingType: Inventory_Mode,
      BookingSource: BookingSource || "",
      BookedBy: BookedBy || "Regular", // New field
      finalPrice: finalPrice || 0 // Store the final discounted price
    }));

    console.log("🗃️ BookingDetails to insert:", newBookingDetails);

    user.bookingDetails.push(...newBookingDetails);

    // Increment earnings for this new booking
    if (finalPrice && finalPrice > 0) {
      const commissionRate = user.commissionRate || 0.10;
      const earningsFromThisBooking = finalPrice * commissionRate;
      user.totalEarnings = (user.totalEarnings || 0) + earningsFromThisBooking;
      console.log(`💰 Added earnings to ${isAgent ? 'Agent' : 'User'}: ₹${earningsFromThisBooking}, Total: ₹${user.totalEarnings}`);
    }

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
    let resolvedApiKey = apiKey;

    if (!resolvedApiKey && hotelCode) {
      const numericHotelCode = Number(hotelCode);
      const filter = Number.isFinite(numericHotelCode) && !Number.isNaN(numericHotelCode)
        ? { hotelCode: numericHotelCode }
        : { hotelCode };
      const hotel = await Hotel.findOne(filter, { authKey: 1 }).lean();
      resolvedApiKey = hotel?.authKey || null;
    }

    if (!hotelCode || !email || !resolvedApiKey) {
      return res.status(400).json({ error: 'hotelCode, email, and apiKey are required' });
    }

    const url = `https://live.ipms247.com/booking/reservation_api/listing.php?request_type=BookingList&HotelCode=${hotelCode}&APIKey=${resolvedApiKey}&arrival_from=&arrival_to=&EmailId=${email}`;

    const response = await axios.get(url);
    const bookingList = response.data.BookingList || [];

    // Fetch local user data to get BookingSource
    // Check Agent collection first
    let user = await Agent.findOne({ email });
    let localBookings = [];

    if (user) {
      localBookings = user.bookingDetails || [];
    } else {
      // If not in Agent, check User collection
      const User = getUserModel;
      user = await User.findOne({ email });
      localBookings = user ? user.bookingDetails : [];
    }

    // Merge BookingSource, BookedBy and finalPrice into bookingList
    const mergedBookingList = bookingList.map(booking => {
      // Ensure we compare strings to avoid type mismatches (Number vs String)
      const localBooking = localBookings.find(lb => String(lb.ResNo) === String(booking.ReservationNo));
      return {
        ...booking,
        Source: localBooking?.BookingSource || booking.Source || "",
        BookedBy: localBooking?.BookedBy || "Regular", // New field
        // Override TotalInclusiveTax with finalPrice if available (shows discounted price)
        TotalInclusiveTax: localBooking?.finalPrice && localBooking.finalPrice > 0
          ? localBooking.finalPrice
          : booking.TotalInclusiveTax
      };
    });

    // Include local-only bookings (e.g. Day Use) that PMS does not return.
    const externalResNos = new Set(
      bookingList
        .map((b) => String(b.ReservationNo || '').trim())
        .filter(Boolean)
    );
    const requestedHotelCode = String(hotelCode || '').trim();
    const localOnlyBookings = localBookings
      .filter((lb) => {
        const resNo = String(lb?.ResNo || '').trim();
        const localHotelCode = String(lb?.HotelCode || '').trim();
        return (
          Boolean(resNo) &&
          !externalResNos.has(resNo) &&
          localHotelCode === requestedHotelCode
        );
      })
      .map((lb) => ({
        ReservationNo: lb.ResNo || '',
        GuestName: lb.GuestName || email,
        ArrivalDate: lb.ArrivalDate || lb.ReservationDate || '',
        DepartureDate: lb.DepartureDate || lb.ArrivalDate || '',
        ReservationDate: lb.ReservationDate || lb.ArrivalDate || '',
        Room: lb.Room || 'Day Use Room',
        RoomNo: lb.RoomNo || '',
        Adult: Number(lb.Adult || 1),
        Child: Number(lb.Child || 0),
        Email: lb.Email || email,
        Mobile: lb.Mobile || '',
        TransactionStatus: lb.TransactionStatus || 'Pay at Hotel',
        BookingStatus: lb.BookingStatus || 'Confirmed Reservation',
        Status: lb.Status || 'Confirmed',
        DueAmount: Number(lb.DueAmount || 0),
        FolioNo: lb.FolioNo || '',
        Source: lb.Source || lb.BookingSource || '',
        NoOfNights: Number(lb.NoOfNights || 0),
        TotalInclusiveTax: Number(lb.finalPrice || 0),
      }));

    // --- Persist Total Earnings Logic ---
    // DISABLED: Auto-recalculation was overwriting manually deducted earnings
    // Earnings are now only updated when new bookings are created or via deductEarnings API
    /*
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
        // Use TotalInclusiveTax which now includes finalPrice if available
        const amount = parseFloat(booking.TotalInclusiveTax || 0);
        return sum + (amount * commissionRate);
      }, 0);

      // Update DB
      user.totalEarnings = totalEarnings;
      await user.save();
    }
    */
    // ------------------------------------

    res.json({
      ...response.data,
      BookingList: [...mergedBookingList, ...localOnlyBookings],
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
    const reservationStr = String(reservationNo || '').trim();

    // Local-only day-use bookings are stored in DB and not present in external PMS.
    if (reservationStr.startsWith('DU-')) {
      const updateCancelled = async (Model) => {
        const doc = await Model.findOne({
          bookingDetails: { $elemMatch: { ResNo: reservationStr } }
        });
        if (!doc) return false;
        const idx = (doc.bookingDetails || []).findIndex((b) => String(b?.ResNo) === reservationStr);
        if (idx === -1) return false;
        doc.bookingDetails[idx].Status = 'Cancelled';
        doc.bookingDetails[idx].BookingStatus = 'Cancelled';
        await doc.save();
        return true;
      };

      const cancelledInAgent = await updateCancelled(Agent);
      const cancelledInUser = cancelledInAgent ? false : await updateCancelled(getUserModel);

      if (!cancelledInAgent && !cancelledInUser) {
        return res.status(404).json({
          success: false,
          message: 'Day-use booking not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Day-use booking cancelled successfully'
      });
    }
    let resolvedApiKey = apiKey;

    if (!resolvedApiKey && hotelCode) {
      const numericHotelCode = Number(hotelCode);
      const filter = Number.isFinite(numericHotelCode) && !Number.isNaN(numericHotelCode)
        ? { hotelCode: numericHotelCode }
        : { hotelCode };
      const hotel = await Hotel.findOne(filter, { authKey: 1 }).lean();
      resolvedApiKey = hotel?.authKey || null;
    }

    if (!hotelCode || !resolvedApiKey || !reservationNo) {
      return res.status(400).json({
        success: false,
        message: "hotelCode, apiKey, and reservationNo are required"
      });
    }

    const url = "https://live.ipms247.com/booking/reservation_api/listing.php";

    const params = {
      request_type: "CancelBooking",
      HotelCode: hotelCode,
      APIKey: resolvedApiKey,
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