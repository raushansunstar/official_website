import DigitalAsset from '../models/DigitalAsset.js';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Upload file for digital asset
// @route   POST /api/digital-assets/upload
// @access  Private/Admin
export const uploadAsset = async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({
                success: false,
                message: 'No file selected'
            });
        }

        const file = req.files.file;

        // Validate file type
        const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|xls|xlsx|txt/;
        const extname = filetypes.test(path.extname(file.name).toLowerCase());

        if (!extname) {
            return res.status(400).json({
                success: false,
                message: 'Error: Files only (Images, PDFs, Docs)!'
            });
        }

        // Create unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.name);
        const filename = 'file-' + uniqueSuffix + ext;

        // Use root uploads directory
        const uploadPath = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        // Move file
        await file.mv(path.join(uploadPath, filename));

        // Return path
        const fileUrl = `/api/media/${filename}`;

        res.status(200).json({
            success: true,
            fileUrl: fileUrl,
            fileName: filename,
            message: 'File uploaded successfully'
        });

    } catch (err) {
        console.error('Upload Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server Error during upload',
            error: err.message
        });
    }
};

// @desc    Get all digital assets
// @route   GET /api/digital-assets
// @access  Public
export const getAssets = async (req, res) => {
    try {
        const assets = await DigitalAsset.find({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: assets.length,
            data: assets
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Create new digital asset
// @route   POST /api/digital-assets
// @access  Private/Admin
export const createAsset = async (req, res) => {
    try {
        const { title, description, fileUrl, fileType, category } = req.body;

        const asset = await DigitalAsset.create({
            title,
            description,
            fileUrl,
            fileType,
            category
        });

        res.status(201).json({
            success: true,
            data: asset
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Delete digital asset
// @route   DELETE /api/digital-assets/:id
// @access  Private/Admin
export const deleteAsset = async (req, res) => {
    try {
        const asset = await DigitalAsset.findById(req.params.id);

        if (!asset) {
            return res.status(404).json({
                success: false,
                message: 'Digital Asset not found'
            });
        }

        await asset.deleteOne();

        res.status(200).json({
            success: true,
            data: {},
            message: 'Digital Asset deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
