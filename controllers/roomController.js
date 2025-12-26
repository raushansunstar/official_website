// controllers/room.controller.js
import axios from 'axios';
import Room from '../models/Room.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import NodeCache from 'node-cache';

// Separate caches for different purposes
const apiCache = new NodeCache({ stdTTL: 300 });      // 5 min for API responses
const monthlyCache = new NodeCache({ stdTTL: 1800 }); // 30 min for monthly rates
const dbCache = new NodeCache({ stdTTL: 600 });       // 10 min for DB lookups

/**
 * Small helpers focused on perf without changing behavior
 */
const num = (v) => {
  if (typeof v === 'string') {
    v = v.replace(/,/g, '');
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const minFromObjValues = (obj) => {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj !== 'object') return num(obj);

  let m = Infinity;
  let found = false;
  for (const k in obj) {
    const n = num(obj[k]);
    if (Number.isFinite(n)) {
      found = true;
      if (n < m) m = n;
    }
  }
  return found ? m : 0;
};

const calculateDefaultRate = (discountRate) => {
  if (!discountRate || isNaN(discountRate) || discountRate <= 0) return 0;
  // Random markup between 30% (1.30) and 40% (1.40)
  const markup = 1 + (Math.random() * (0.40 - 0.30) + 0.30);
  return Math.round(discountRate * markup);
};

const processGroupedRoomData = (roomList) => {
  const grouped = Object.create(null);

  for (let i = 0; i < roomList.length; i++) {
    const room = roomList[i];
    const key = room.Roomtype_Name;

    const minAvailable = minFromObjValues(room.available_rooms);
    const minExclusiveTax = minFromObjValues(room.room_rates_info?.exclusive_tax);

    const next = {
      Roomtype_Name: room.Roomtype_Name,
      Room_Max_adult: room.Room_Max_adult,
      Room_Max_child: room.Room_Max_child,
      hotelcode: room.hotelcode,
      roomtypeunkid: room.roomtypeunkid,
      ratetypeunkid: room.ratetypeunkid,
      roomrateunkid: room.roomrateunkid,
      min_available_rooms: minAvailable,
      min_exclusive_tax: minExclusiveTax,
      base_adult_occupancy: room.base_adult_occupancy,
      max_adult_occupancy: room.max_adult_occupancy,
      extra_adult_rates_info: room.extra_adult_rates_info,
      extra_child_rates_info: room.extra_child_rates_info,
    };

    const cur = grouped[key];
    if (!cur || minExclusiveTax < cur.min_exclusive_tax || minAvailable < cur.min_available_rooms) {
      grouped[key] = next;
    }
  }

  return Object.values(grouped);
};

/**
 * Retry wrapper with exponential backoff
 */
const fetchWithRetry = async (url, retries = 2, timeout = 20000) => {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await axios.get(url, {
        timeout,
        decompress: true,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      if (attempt > retries) throw err;
      console.warn(`[API RETRY ${attempt}/${retries}] ${err.message}`);
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
};

/**
 * Batch fetch room list from IPMS247 with caching
 */
const fetchRoomListCached = async (hotelCode, authCode, fromDate, numNights) => {
  const cacheKey = `roomlist_${hotelCode}_${fromDate}_${numNights}`;
  const cached = apiCache.get(cacheKey);

  if (cached) {
    console.log(`[Cache HIT] ${cacheKey}`);
    return cached;
  }

  const url = `https://live.ipms247.com/booking/reservation_api/listing.php?request_type=RoomList&HotelCode=${hotelCode}&APIKey=${authCode}&check_in_date=${fromDate}&num_nights=${numNights}&number_adults=1&number_children=0&num_rooms=1&promotion_code=&property_configuration_info=0&showtax=0&show_only_available_rooms=0&language=en&roomtypeunkid=&packagefor=DESKTOP&promotionfor=DESKTOP`;

  const response = await fetchWithRetry(url, 2, 20000);
  const data = response.data;

  // Cache for 5 minutes
  apiCache.set(cacheKey, data, 300);

  return data;
};

export const getRoomList = async (req, res) => {
  try {
    const { hotelCode, authCode, fromDate, toDate } = req.query;
    const numNights = toDate ? dayjs(toDate).diff(dayjs(fromDate), 'day') : 1;

    const roomList = await fetchRoomListCached(hotelCode, authCode, fromDate, numNights);
    const processedData = processGroupedRoomData(roomList);

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error('Error fetching room list:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room list',
    });
  }
};

/**
 * ⚡ OPTIMIZED getSyncedRooms
 */
export const getSyncedRooms = async (req, res) => {
  const startTime = Date.now();

  try {
    const { hotelCode, authCode, fromDate, toDate, skipCache } = req.query;

    if (!hotelCode || !authCode) {
      return res
        .status(400)
        .json({ error: 'hotelCode and authCode are required as query parameters' });
    }

    const finalFromDate = fromDate || dayjs().format('YYYY-MM-DD');
    const finalToDate = toDate || dayjs().add(1, 'day').format('YYYY-MM-DD');
    const numNights = dayjs(finalToDate).diff(dayjs(finalFromDate), 'day') || 1;

    // ========== 1) FETCH FROM IPMS247 (WITH CACHE) ==========
    let roomList;
    const apiCacheKey = `sync_roomlist_${hotelCode}_${finalFromDate}_${numNights}`;

    if (!skipCache) {
      roomList = apiCache.get(apiCacheKey);
    }

    if (!roomList) {
      console.log(`[getSyncedRooms] Fetching from API...`);
      roomList = await fetchRoomListCached(hotelCode, authCode, finalFromDate, numNights);
      apiCache.set(apiCacheKey, roomList, 300);
    } else {
      console.log(`[getSyncedRooms] Using cached API response`);
    }

    if (!Array.isArray(roomList) || roomList.length === 0) {
      return res.json({
        message: 'No rooms returned from API',
        upsertedRecords: 0,
        rooms: [],
      });
    }

    // ========== 2) GROUP BY ROOMTYPE (In-memory, fast) ==========
    const grouped = Object.create(null);

    for (const room of roomList) {
      const key = room.Roomtype_Name;
      const minAvailable = minFromObjValues(room.available_rooms);
      const minExclusiveTax = minFromObjValues(room.room_rates_info?.exclusive_tax);

      const candidate = {
        Roomtype_Name: room.Roomtype_Name,
        Room_Max_adult: room.Room_Max_adult,
        Room_Max_child: room.Room_Max_child,
        hotelcode: room.hotelcode,
        roomtypeunkid: room.roomtypeunkid,
        ratetypeunkid: room.ratetypeunkid,
        roomrateunkid: room.roomrateunkid,
        min_available_rooms: minAvailable,
        min_exclusive_tax: minExclusiveTax,
        base_adult_occupancy: room.base_adult_occupancy,
        max_adult_occupancy: room.max_adult_occupancy,
        extra_adult_rates_info: room.extra_adult_rates_info,
        extra_child_rates_info: room.extra_child_rates_info,
      };

      const cur = grouped[key];
      if (!cur || minExclusiveTax < cur.min_exclusive_tax || minAvailable < cur.min_available_rooms) {
        grouped[key] = candidate;
      }
    }

    const lowestRateRooms = Object.values(grouped);
    console.log(`[getSyncedRooms] Processing ${lowestRateRooms.length} unique room types`);

    // ========== 3) FETCH EXISTING ROOMS FROM DB (WITH CACHE) ==========
    const idsToFetch = [...new Set(lowestRateRooms.map((r) => String(r.roomtypeunkid)))];
    const dbCacheKey = `db_rooms_${hotelCode}_${idsToFetch.sort().join('_')}`;

    let existingRooms = dbCache.get(dbCacheKey);

    if (!existingRooms) {
      existingRooms = await Room.find(
        { RoomTypeID: { $in: idsToFetch } },
        {
          RoomTypeID: 1,
          RoomImage: 1,
          RoomDescription: 1,
          AboutRoom: 1,
          Amenities: 1,
          squareFeet: 1,
          show: 1,
          source: 1,
        }
      ).lean();

      dbCache.set(dbCacheKey, existingRooms, 600);
    }

    // Build lookup map (prefer entries with images)
    const byTypeId = new Map();
    for (const doc of existingRooms) {
      const key = String(doc.RoomTypeID);
      const current = byTypeId.get(key);
      const hasImg = Array.isArray(doc.RoomImage) && doc.RoomImage.length > 0;
      const currentHasImg = current && Array.isArray(current.RoomImage) && current.RoomImage.length > 0;

      if (!current || (hasImg && !currentHasImg)) {
        byTypeId.set(key, doc);
      }
    }

    // ========== 4) PREPARE BULK OPERATIONS ==========
    const ops = [];
    const enhancedRoomsMap = new Map(); // To avoid re-querying

    for (const room of lowestRateRooms) {
      const roomDetails = byTypeId.get(String(room.roomtypeunkid));

      const enhancedRoom = {
        RoomTypeID: room.roomtypeunkid,
        RateTypeID: room.ratetypeunkid,
        roomrateunkid: room.roomrateunkid,
        HotelCode: room.hotelcode,
        RoomName: room.Roomtype_Name,
        Availability: room.min_available_rooms,
        discountRate: room.min_exclusive_tax,
        defaultRate: calculateDefaultRate(room.min_exclusive_tax),
        maxGuests: parseInt(room.Room_Max_adult) || 1,
        baseAdultOccupancy: parseInt(room.base_adult_occupancy) || 2,
        maxAdultOccupancy: parseInt(room.max_adult_occupancy) || 3,
        extraAdultRate: parseFloat(room.extra_adult_rates_info?.rack_rate) || 0,
        extraChildRate: parseFloat(room.extra_child_rates_info?.rack_rate) || 0,
        RoomImage: roomDetails?.RoomImage || [],
        RoomDescription: roomDetails?.RoomDescription,
        AboutRoom: roomDetails?.AboutRoom || {},
        Amenities: roomDetails?.Amenities || [],
        squareFeet: roomDetails?.squareFeet,
        show: roomDetails?.show ?? true,
        source: roomDetails?.source || 'API',
        FromDate: finalFromDate,
        ToDate: finalToDate,
      };

      const filterKey = `${enhancedRoom.RoomTypeID}|${enhancedRoom.RateTypeID}|${enhancedRoom.roomrateunkid}`;
      enhancedRoomsMap.set(filterKey, enhancedRoom);

      ops.push({
        updateOne: {
          filter: {
            RoomTypeID: enhancedRoom.RoomTypeID,
            RateTypeID: enhancedRoom.RateTypeID,
            roomrateunkid: enhancedRoom.roomrateunkid,
          },
          update: { $set: enhancedRoom },
          upsert: true,
        },
      });
    }

    // ========== 5) EXECUTE BULK WRITE ==========
    let upsertedCount = 0;

    if (ops.length > 0) {
      const bulkResult = await Room.bulkWrite(ops, { ordered: false });
      upsertedCount = (bulkResult?.upsertedCount || 0) + (bulkResult?.modifiedCount || 0);

      // Invalidate DB cache after update
      dbCache.del(dbCacheKey);
    }

    // ========== 6) BUILD RESPONSE WITHOUT RE-QUERYING ==========
    // Instead of re-querying, we fetch only the _id fields we need
    const filters = lowestRateRooms.map(r => ({
      RoomTypeID: r.roomtypeunkid,
      RateTypeID: r.ratetypeunkid,
      roomrateunkid: r.roomrateunkid,
    }));

    // Single efficient query with only needed fields
    const updatedDocs = await Room.find(
      { $or: filters },
      { __v: 0 } // Exclude version key
    ).lean();

    // Order the results to match input order
    const keyOf = (d) => `${d.RoomTypeID}|${d.RateTypeID}|${d.roomrateunkid}`;
    const docMap = new Map(updatedDocs.map((d) => [keyOf(d), d]));

    const orderedRooms = filters
      .map((f) => docMap.get(`${f.RoomTypeID}|${f.RateTypeID}|${f.roomrateunkid}`))
      .filter(Boolean);

    const duration = Date.now() - startTime;
    console.log(`[getSyncedRooms] Completed in ${duration}ms - ${orderedRooms.length} rooms`);

    return res.json({
      message: 'Rooms synchronized successfully using JSON API',
      upsertedRecords: ops.length,
      rooms: orderedRooms,
      timing: `${duration}ms`,
    });

  } catch (error) {
    console.error('Error syncing rooms:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id).lean();
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRoom = await Room.findByIdAndDelete(id);
    if (!deletedRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createRoom = async (req, res) => {
  try {
    let {
      RoomTypeID,
      RateTypeID,
      roomrateunkid,
      RoomImage,
      HotelCode,
      RoomName,
      RoomDescription,
      Amenities,
      AboutRoom,
      defaultRate,
      discountRate,
      Availability,
      available,
      FromDate,
      ToDate,
      source,
      maxGuests,
      squareFeet,
      uniqueRoomIdentifier,
    } = req.body;

    if (!RoomTypeID || !RateTypeID || !RoomName || !HotelCode) {
      return res
        .status(400)
        .json({ error: 'RoomTypeID, RateTypeID, RoomName, and HotelCode are required' });
    }

    const finalFromDate = FromDate || new Date().toISOString().split('T')[0];
    const finalToDate = ToDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const computedDiscountRate = discountRate !== undefined ? parseFloat(discountRate) : undefined;
    const parsedAvailability = Availability !== undefined ? parseInt(Availability) : 0;
    const generatedUniqueId = uniqueRoomIdentifier || `${HotelCode}-${RoomTypeID}-${RateTypeID}-${Date.now()}`;

    const existingRoom = await Room.findOne({ RoomTypeID, RateTypeID }, { _id: 1 }).lean();
    if (existingRoom) {
      RoomTypeID = `${RoomTypeID}-${Date.now()}`;
    }

    const newRoom = new Room({
      RoomTypeID,
      RateTypeID,
      roomrateunkid,
      RoomImage,
      HotelCode,
      RoomName,
      RoomDescription,
      Amenities,
      AboutRoom,
      AboutRoom,
      defaultRate: computedDiscountRate ? calculateDefaultRate(computedDiscountRate) : (defaultRate !== undefined ? parseFloat(defaultRate) : undefined),
      discountRate: computedDiscountRate,
      Availability: parsedAvailability,
      FromDate: finalFromDate,
      ToDate: finalToDate,
      source,
      maxGuests,
      squareFeet,
      available,
      uniqueRoomIdentifier: generatedUniqueId,
    });

    await newRoom.save();
    return res.status(201).json({ room: newRoom });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid room ID format',
        details: 'ID must be a valid MongoDB ObjectId',
      });
    }

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error: 'No update data provided',
        details: 'Request body cannot be empty',
      });
    }

    const updateData = { ...req.body };
    if (updateData.discountRate !== undefined) {
      updateData.discountRate = parseFloat(updateData.discountRate);
      updateData.defaultRate = calculateDefaultRate(updateData.discountRate);
    } else if (updateData.defaultRate !== undefined) {
      // Only allow manual override if discountRate is NOT being updated (though frontend disables this)
      updateData.defaultRate = parseFloat(updateData.defaultRate);
    }
    if (updateData.Availability !== undefined) updateData.Availability = parseInt(updateData.Availability);

    const updatedRoom = await Room.findOneAndUpdate(
      { _id: id },
      { $set: updateData },
      { new: true, runValidators: true, context: 'query' }
    );

    if (!updatedRoom) {
      return res.status(404).json({
        error: 'Room not found',
        details: `No room found with ID: ${id}`,
      });
    }

    return res.status(200).json({
      message: 'Room updated successfully',
      room: updatedRoom,
    });
  } catch (error) {
    console.error('Error updating room:', error.message);

    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation failed', details: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid data format', details: error.message });
    }

    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const MAX_NIGHTS = 30;

/**
 * ⚡ OPTIMIZED getMonthlyRoomRates with parallel chunk fetching
 */
export const getMonthlyRoomRates = async (req, res) => {
  const startTime = Date.now();

  try {
    const { hotelCode, authCode, month } = req.query;

    if (!hotelCode || !authCode || !month) {
      return res.status(400).json({
        success: false,
        error: "hotelCode, authCode and month (YYYY-MM) are required"
      });
    }

    const startOfMonth = dayjs(`${month}-01`);
    if (!startOfMonth.isValid()) {
      return res.status(400).json({
        success: false,
        error: "Invalid month format"
      });
    }

    const today = dayjs().startOf("day");
    const endOfMonth = startOfMonth.endOf("month");
    const daysInMonth = startOfMonth.daysInMonth();

    // Initialize calendar
    const calendar = {};
    for (let i = 0; i < daysInMonth; i++) {
      const d = startOfMonth.add(i, "day").format("YYYY-MM-DD");
      calendar[d] = { price: null, available: 0, soldOut: true };
    }

    // If entire month is in past
    if (endOfMonth.isBefore(today)) {
      return res.json({ success: true, data: calendar, cached: false });
    }

    const apiStartDate = startOfMonth.isBefore(today) ? today : startOfMonth;
    const apiDays = endOfMonth.diff(apiStartDate, "day") + 1;

    // Check cache
    const cacheKey = `monthly_rates_${hotelCode}_${month}`;
    const cached = monthlyCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    // ========== PARALLEL CHUNK FETCHING ==========
    const chunks = [];
    let offset = 0;

    while (offset < apiDays) {
      const chunkStart = apiStartDate.add(offset, "day");
      const chunkNights = Math.min(MAX_NIGHTS, apiDays - offset);
      chunks.push({ start: chunkStart, nights: chunkNights });
      offset += chunkNights;
    }

    // Fetch all chunks in parallel (max 6 concurrent)
    const CONCURRENCY = 6;
    const allApiData = [];

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);

      const promises = batch.map(async ({ start, nights }) => {
        const url =
          `https://live.ipms247.com/booking/reservation_api/listing.php` +
          `?request_type=RoomList` +
          `&HotelCode=${encodeURIComponent(hotelCode)}` +
          `&APIKey=${encodeURIComponent(authCode)}` +
          `&check_in_date=${start.format("YYYY-MM-DD")}` +
          `&num_nights=${nights}` +
          `&number_adults=1&number_children=0&num_rooms=1` +
          `&property_configuration_info=0&showtax=0` +
          `&show_only_available_rooms=0&language=en`;

        try {
          const response = await fetchWithRetry(url, 2, 30000);
          return Array.isArray(response?.data) ? response.data : [];
        } catch (err) {
          console.error(`[Monthly API FAIL] ${start.format("YYYY-MM-DD")}:`, err.message);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(data => allApiData.push(...data));
    }

    // Merge all API data into calendar - Optimized loop
    const dates = Object.keys(calendar);

    for (const room of allApiData) {
      if (!room) continue;

      const availObj = room.available_rooms || {};
      const ratesInfo = room.room_rates_info || {};
      const priceObj = ratesInfo.exclusive_tax || {};

      // Only iterate dates that exists in both calendar and response
      for (const date of dates) {
        const available = availObj[date];
        if (available === undefined) continue; // Skip if no data for this date

        const numAvailable = Number(available) || 0;

        if (numAvailable > 0) {
          const calDate = calendar[date];
          calDate.soldOut = false;
          // Math.max is slower than simple if in tight loops
          if (numAvailable > calDate.available) {
            calDate.available = numAvailable;
          }

          const price = priceObj[date];
          if (price !== undefined) {
            const numPrice = Number(price) || 0;
            if (numPrice > 0) {
              if (calDate.price === null || numPrice < calDate.price) {
                calDate.price = numPrice;
              }
            }
          }
        }
      }
    }

    // Cache and respond
    monthlyCache.set(cacheKey, calendar, 1800);

    console.log(`[getMonthlyRoomRates] ${hotelCode} ${month} in ${Date.now() - startTime}ms`);

    return res.json({
      success: true,
      data: calendar,
      cached: false,
      timing: `${Date.now() - startTime}ms`
    });

  } catch (err) {
    console.error("[getMonthlyRoomRates ERROR]", err);
    return res.status(200).json({
      success: false,
      data: {},
      error: "Failed to fetch monthly rates"
    });
  }
};

/**
 * ⚡ LIGHTWEIGHT VERSION - Returns cached/minimal data quickly
 */
export const getSyncedRoomsLight = async (req, res) => {
  try {
    const { hotelCode, authCode, fromDate, toDate } = req.query;

    if (!hotelCode || !authCode) {
      return res.status(400).json({ error: 'hotelCode and authCode are required' });
    }

    const finalFromDate = fromDate || dayjs().format('YYYY-MM-DD');
    const finalToDate = toDate || dayjs().add(1, 'day').format('YYYY-MM-DD');
    const numNights = dayjs(finalToDate).diff(dayjs(finalFromDate), 'day') || 1;

    const cacheKey = `light_rooms_${hotelCode}_${finalFromDate}_${numNights}`;
    const cached = apiCache.get(cacheKey);

    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Only fetch from API, minimal DB interaction
    const roomList = await fetchRoomListCached(hotelCode, authCode, finalFromDate, numNights);
    const processedData = processGroupedRoomData(roomList || []);

    const result = {
      message: 'Rooms fetched successfully',
      count: processedData.length,
      rooms: processedData,
    };

    apiCache.set(cacheKey, result, 300);

    return res.json({ ...result, cached: false });

  } catch (error) {
    console.error('Error in getSyncedRoomsLight:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};