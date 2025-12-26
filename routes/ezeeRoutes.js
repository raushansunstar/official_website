// routes/ezeeRoutes.js
import express from 'express';
import { addHotel, deleteHotel, editHotel, getAllHotels, getSingleHotel } from '../controllers/adminHotelController.js';
import { createRoom, deleteRoomById, getRoomById, getRoomList, getSyncedRooms, updateRoom, getMonthlyRoomRates } from '../controllers/roomController.js';
import { getRoomAndHotelDetails } from '../controllers/getRoomAndHotelDetails.js';
import { bookDayUseSlot, bulkUpdateDayUseAvailability, cancelDayUseSlot, getDayUseRooms, getMonthlyDayUseData, updateDayUseAvailability } from '../controllers/dayUseRoomController.js';
import {
    getPage,
    upsertPage,
    patchHero,
    patchDescCard,
    setTermsPoints,
    addBenefit,
    updateBenefit,
    deleteBenefit,
} from '../controllers/DayUseRoomContent.js';

const router = express.Router();


router.get('/day-use-rooms', getDayUseRooms);
router.get('/monthly', getMonthlyDayUseData);
router.put('/update-availability', updateDayUseAvailability);
router.post('/dayuse/bulk-update', bulkUpdateDayUseAvailability);
router.post('/dayuse/book', bookDayUseSlot);
router.post('/dayuse/cancel', cancelDayUseSlot);




router.get('/dayuse/content', getPage);
router.put('/dayuse/content', /* adminOnly, */ upsertPage);
router.patch('/dayuse/content/hero', /* adminOnly, */ patchHero);
router.patch('/dayuse/content/desc-card', /* adminOnly, */ patchDescCard);
router.post('/dayuse/content/benefits', /* adminOnly, */ addBenefit);
router.put('/dayuse/content/benefits/:benefitId', /* adminOnly, */ updateBenefit);
router.delete('/dayuse/content/benefits/:benefitId', /* adminOnly, */ deleteBenefit);
router.put('/dayuse/content/tandc', /* adminOnly, */ setTermsPoints);




router.get('/allhotels', getAllHotels);
router.post('/add/hotel', addHotel);
router.get('/hotels/:hotelCode', getSingleHotel);
router.put('/edit/hotel/:hotelCode', editHotel);
router.delete('/delete/hotel/:hotelCode', deleteHotel);


router.get('/syncedRooms', getSyncedRooms);
router.get('/monthly-rates', getMonthlyRoomRates);
router.get('/room-list', getRoomList);
router.post('/rooms', createRoom);
router.get('/room/:id', getRoomById);
router.delete('/room/:id', deleteRoomById);
router.put('/rooms/:id', updateRoom);



router.get('/details', getRoomAndHotelDetails);


export default router;