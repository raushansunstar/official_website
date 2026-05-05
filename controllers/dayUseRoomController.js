// controllers/dayUseRoomController.js

import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import DayUseRoom from '../models/DayUseRoom.js';
import User from '../models/User.js';
import { Agent } from '../models/Agent.js';


const roomTypeMap = {
  "14492": ["Standard Room"],
  "14494": ["Standard Room"],
  "14496": ["Standard Room"],
  "14493": ["Standard Room", "Family Room"]  // ✅ multiple allowed
};


export const getDayUseRooms = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });

    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      return res.status(200).json({ data: [], message: 'Past dates are not allowed' });
    }

    const hotels = await Hotel.find();
    const result = [];

    for (const hotel of hotels) {
      if (!hotel.isDayUseRoom) continue;

      const roomTypes = roomTypeMap[hotel.hotelCode.toString()] || [];
      const allRooms = await Room.find({
        HotelCode: hotel.hotelCode.toString(),
        RoomName: { $in: roomTypes }
      });

      // Prioritize room with images, then fallback to the first one
      const standardRoom = allRooms.find(r => r.RoomImage && r.RoomImage.length > 0) || allRooms[0];


      const fullDayRate = Number((standardRoom.discountRate * 0.6).toFixed(2));

      // console.log(fullDayRate, "fullDayRate")

      let dayUseData = await DayUseRoom.findOne({
        hotel: hotel._id,
        room: standardRoom._id,
        date
      });

      if (!dayUseData) {
        dayUseData = await DayUseRoom.create({
          hotel: hotel._id,
          room: standardRoom._id,
          date,
          slots: [
            {
              timeSlot: "Full Day",
              rate: fullDayRate,
              availability: 0
            }
          ]
        });
      }
      const fullDaySlot = dayUseData.slots.find(slot => slot.timeSlot === 'Full Day') || { availability: 0 };

      result.push({
        hotel: {
          name: hotel.name,
          hotelCode: hotel.hotelCode,
          location: hotel.location,
          apiKey: hotel.authKey,
          rating: hotel.rating
        },
        room: standardRoom.toObject(),
        dayUse: {
          date: dayUseData.date,
          availability: fullDaySlot.availability ?? 0,
          rate: fullDayRate,
          soldOut: (fullDaySlot.availability ?? 0) <= 0
        }
      });

    }

    return res.status(200).json({
      message: 'Day use rooms fetched successfully',
      data: result
    });

  } catch (error) {
    console.error('Error fetching day use rooms:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getMonthlyDayUseData = async (req, res) => {
  try {
    const { month, hotelCode } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Valid month is required in YYYY-MM format' });
    }

    const currentMonth = new Date();
    const requestedMonth = new Date(`${month}-01`);
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    if (requestedMonth < currentMonth) {
      return res.status(200).json({ data: [], message: 'Past months are not allowed' });
    }

    const startDate = new Date(`${month}-01`);
    const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));
    let hotels = [];

    if (hotelCode) {
      const hotel = await Hotel.findOne({ hotelCode });

      if (!hotel) {
        return res.status(200).json({ data: [], message: 'Hotel not found' });
      }

      if (!hotel.isDayUseRoom) {
        return res.status(200).json({
          data: [{
            hotel: { name: hotel.name, hotelCode: hotel.hotelCode },
            error: 'This hotel is not available for day use'
          }]
        });
      }

      hotels.push(hotel);
      console.log(hotel)
    } else {
      hotels = await Hotel.find({ isDayUseRoom: true });
    }

    const results = [];

    for (const hotel of hotels) {


      const roomType = roomTypeMap[hotel.hotelCode.toString()] || 'Standard Room';

      const standardRoom = await Room.findOne({
        HotelCode: hotel.hotelCode.toString(),
        RoomName: roomType
      });


      if (!standardRoom) {
        console.warn(`Room not found for HotelCode ${hotel.hotelCode}, RoomName ${roomType}`);
        continue;
      }

      const fullDayRate = Number((standardRoom.discountRate * 0.4).toFixed(2));

      const dayUseEntries = await DayUseRoom.find({
        hotel: hotel._id,
        room: standardRoom._id,
        date: {
          $gte: startDate.toISOString().split('T')[0],
          $lt: endDate.toISOString().split('T')[0]
        }
      });

      const entryMap = {};
      dayUseEntries.forEach(entry => {
        const fullDaySlot = entry.slots.find(s => s.timeSlot === 'Full Day') || { availability: 0 };
        entryMap[entry.date] = {
          availability: fullDaySlot.availability ?? 0,
          rate: fullDayRate,
          soldOut: (fullDaySlot.availability ?? 0) <= 0
        };
      });

      const monthData = {};
      const year = startDate.getFullYear();
      const monthNum = startDate.getMonth();
      const today = new Date();
      const todayDate = today.getDate();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthNum;
      const daysInMonth = new Date(year, monthNum + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        if (isCurrentMonth && d < todayDate) continue;

        const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // If missing, seed it now
        if (!entryMap[dateStr]) {
          await DayUseRoom.create({
            hotel: hotel._id,
            room: standardRoom._id,
            date: dateStr,
            slots: [
              {
                timeSlot: "Full Day",
                rate: fullDayRate,
                availability: 0
              }
            ]
          });

          monthData[dateStr] = {
            availability: 0,
            rate: fullDayRate,
            soldOut: true
          };
        } else {
          monthData[dateStr] = entryMap[dateStr];
        }
      }

      results.push({
        hotel: {
          name: hotel.name,
          hotelCode: hotel.hotelCode,
          location: hotel.location,
          rating: hotel.rating
        },
        room: {
          _id: standardRoom._id,
          RoomName: standardRoom.RoomName,
          RoomImage: standardRoom.RoomImage,
          AboutRoom: standardRoom.AboutRoom,
          Amenities: standardRoom.Amenities,
          squareFeet: standardRoom.squareFeet
        },
        monthData
      });
    }

    return res.status(200).json({
      message: 'Month-wise day use data fetched successfully',
      data: results
    });

  } catch (error) {
    console.error('Error fetching monthly day use data:', error);
    return res.status(500).json({ error: error.message });
  }
};


export const updateDayUseAvailability = async (req, res) => {
  try {
    const { hotelCode, roomName, date, timeSlot, availability } = req.body;

    if (!hotelCode || !roomName || !date || availability === undefined) {
      return res.status(400).json({ error: 'hotelCode, roomName, date, and availability are required' });
    }

    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      return res.status(400).json({ error: 'Cannot update availability for past dates' });
    }

    const hotel = await Hotel.findOne({ hotelCode });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    if (!hotel.isDayUseRoom) {
      return res.status(400).json({ error: 'This hotel is not available for day use' });
    }

    const room = await Room.findOne({ HotelCode: hotelCode, RoomName: roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const cleanDate = date.split('T')[0];

    const dayUse = await DayUseRoom.findOne({
      hotel: hotel._id,
      room: room._id,
      date: cleanDate
    });


    if (!dayUse) {
      return res.status(404).json({ error: 'Day use data not found for given date' });
    }

    const slotName = timeSlot || 'Full Day';
    const slotIndex = dayUse.slots.findIndex(slot => slot.timeSlot === slotName);

    if (slotIndex === -1) {
      return res.status(404).json({ error: `Time slot '${slotName}' not found` });
    }

    dayUse.slots[slotIndex].availability = availability;
    await dayUse.save();

    return res.status(200).json({
      message: `Availability for '${slotName}' on ${cleanDate} updated successfully`,
      dayUse
    });

  } catch (error) {
    console.error('Error updating availability:', error);
    return res.status(500).json({ error: error.message });
  }
};


export const bulkUpdateDayUseAvailability = async (req, res) => {
  try {
    const { date, updates } = req.body;

    if (!date || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Date and updates array are required' });
    }

    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      return res.status(400).json({ error: 'Cannot update availability for past dates' });
    }

    const cleanDate = date.split('T')[0];

    const success = [];
    const failed = [];

    for (const update of updates) {
      const { hotelCode, roomName, timeSlot = 'Full Day', availability } = update;

      if (!hotelCode || !roomName || availability === undefined) {
        failed.push({ hotelCode, roomName, reason: 'Missing hotelCode, roomName or availability' });
        continue;
      }

      try {
        const hotel = await Hotel.findOne({ hotelCode });
        if (!hotel || !hotel.isDayUseRoom) {
          failed.push({ hotelCode, roomName, reason: 'Hotel not found or not eligible for day use' });
          continue;
        }

        const room = await Room.findOne({ HotelCode: hotelCode, RoomName: roomName });
        if (!room) {
          failed.push({ hotelCode, roomName, reason: 'Room not found' });
          continue;
        }

        const dayUse = await DayUseRoom.findOne({
          hotel: hotel._id,
          room: room._id,
          date: cleanDate
        });

        if (!dayUse) {
          failed.push({ hotelCode, roomName, reason: 'Day use entry not found' });
          continue;
        }

        const slotIndex = dayUse.slots.findIndex(slot => slot.timeSlot === timeSlot);
        if (slotIndex === -1) {
          failed.push({ hotelCode, roomName, reason: `Slot '${timeSlot}' not found` });
          continue;
        }

        dayUse.slots[slotIndex].availability = availability;
        await dayUse.save();

        success.push({ hotelCode, roomName, availability });

      } catch (err) {
        failed.push({ hotelCode: update.hotelCode, roomName: update.roomName, reason: err.message });
      }
    }

    return res.status(200).json({
      message: 'Bulk update completed',
      success,
      failed
    });

  } catch (error) {
    console.error('Error in bulk availability update:', error);
    return res.status(500).json({ error: error.message });
  }
};

const DEFAULT_TIMESLOT = 'Full Day';

const persistDayUseBooking = async ({
  userEmail,
  guestName,
  mobile,
  hotelCode,
  roomName,
  date,
  finalPrice,
  bookingSource = 'DayUse'
}) => {
  if (!userEmail) return null;

  const reservationNo = `DU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const amount = Number(finalPrice) > 0 ? Number(finalPrice) : 0;
  const bookingRecord = {
    HotelCode: String(hotelCode),
    BookingType: 'DayUse',
    BookingSource: bookingSource,
    Source: bookingSource,
    BookedBy: 'Regular',
    finalPrice: amount,
    ResNo: reservationNo,
    SubNo: '1',
    ArrivalDate: date,
    DepartureDate: date,
    ReservationDate: new Date().toISOString().slice(0, 10),
    GuestName: guestName || userEmail,
    Email: userEmail,
    Mobile: mobile || '',
    NoOfNights: 0,
    Status: 'Confirmed',
    BookingStatus: 'Confirmed Reservation',
    TransactionStatus: 'Pay at Hotel',
    Room: roomName || 'Day Use Room',
    RoomNo: 'Day Use',
    Adult: 1,
    Child: 0,
    FolioNo: '',
    DueAmount: 0,
  };

  let account = await Agent.findOne({ email: userEmail });
  if (!account) account = await User.findOne({ email: userEmail });
  if (!account) return null;

  account.bookingDetails.push(bookingRecord);
  await account.save();
  return bookingRecord;
};

export const bookDayUseSlot = async (req, res) => {
  try {
    const {
      hotelCode,
      roomName,
      date,
      qty = 1,
      timeSlot = DEFAULT_TIMESLOT,
      userEmail,
      guestName,
      mobile,
      finalPrice,
      bookingSource
    } = req.body;

    if (!hotelCode || !roomName || !date || qty <= 0) {
      return res.status(400).json({ error: 'hotelCode, roomName, date, and positive qty are required' });
    }

    const inputDate = new Date(date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (inputDate < today) return res.status(400).json({ error: 'Past dates not allowed' });

    const hotel = await Hotel.findOne({ hotelCode });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    if (!hotel.isDayUseRoom) return res.status(400).json({ error: 'This hotel is not available for day use' });

    const room = await Room.findOne({ HotelCode: hotelCode, RoomName: roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const cleanDate = date.split('T')[0];

    // Atomic decrement only if enough availability exists
    const updated = await DayUseRoom.findOneAndUpdate(
      {
        hotel: hotel._id,
        room: room._id,
        date: cleanDate,
        'slots.timeSlot': timeSlot,
        // guard: availability >= qty
        // NOTE: positional $ works only when matching same element
        // we check using this condition on the same matched slot
        'slots.availability': { $gte: qty }
      },
      { $inc: { 'slots.$.availability': -qty } },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Not enough availability or slot not found',
        details: { hotelCode, roomName, date: cleanDate, timeSlot, qty }
      });
    }

    const slot = updated.slots.find(s => s.timeSlot === timeSlot);
    const bookingRecord = await persistDayUseBooking({
      userEmail,
      guestName,
      mobile,
      hotelCode,
      roomName,
      date: cleanDate,
      finalPrice,
      bookingSource
    });

    return res.status(200).json({
      message: 'Booked successfully: availability decremented',
      remainingAvailability: slot?.availability ?? 0,
      dayUse: updated,
      booking: bookingRecord
    });

  } catch (err) {
    console.error('Error in bookDayUseSlot:', err);
    return res.status(500).json({ error: err.message });
  }
};


export const cancelDayUseSlot = async (req, res) => {
  try {
    const { hotelCode, roomName, date, qty = 1, timeSlot = DEFAULT_TIMESLOT } = req.body;

    if (!hotelCode || !roomName || !date || qty <= 0) {
      return res.status(400).json({ error: 'hotelCode, roomName, date, and positive qty are required' });
    }

    const inputDate = new Date(date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (inputDate < today) return res.status(400).json({ error: 'Past dates not allowed' });

    const hotel = await Hotel.findOne({ hotelCode });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    if (!hotel.isDayUseRoom) return res.status(400).json({ error: 'This hotel is not available for day use' });

    const room = await Room.findOne({ HotelCode: hotelCode, RoomName: roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const cleanDate = date.split('T')[0];

    // Atomic increment on the matched slot
    const updated = await DayUseRoom.findOneAndUpdate(
      {
        hotel: hotel._id,
        room: room._id,
        date: cleanDate,
        'slots.timeSlot': timeSlot
      },
      { $inc: { 'slots.$.availability': +qty } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Day use entry or slot not found' });
    }

    const slot = updated.slots.find(s => s.timeSlot === timeSlot);
    return res.status(200).json({
      message: 'Cancelled successfully: availability incremented',
      currentAvailability: slot?.availability ?? 0,
      dayUse: updated
    });

  } catch (err) {
    console.error('Error in cancelDayUseSlot:', err);
    return res.status(500).json({ error: err.message });
  }
};
