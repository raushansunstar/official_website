import express from 'express';
import {
    getAssets,
    createAsset,
    deleteAsset,
    uploadAsset
} from '../controllers/digitalAssetController.js';

const router = express.Router();

router.route('/upload').post(uploadAsset);

router.route('/')
    .get(getAssets)
    .post(createAsset);

router.route('/:id')
    .delete(deleteAsset);

export default router;
