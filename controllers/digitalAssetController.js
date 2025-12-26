import DigitalAsset from '../models/DigitalAsset.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Go up one level from controllers to root, then into build/public/media
        const uploadPath = path.join(__dirname, '..', 'build', 'public', 'media');

        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Create unique filename: timestamp-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// Init upload
export const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('file'); // Expecting 'file' field name

// Check file type
function checkFileType(file, cb) {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|xls|xlsx|txt/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    // const mimetype = filetypes.test(file.mimetype);

    if (extname) {
        return cb(null, true);
    } else {
        cb('Error: Files only (Images, PDFs, Docs)!');
    }
}

// @desc    Upload file for digital asset
// @route   POST /api/digital-assets/upload
// @access  Private/Admin
export const uploadAsset = (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file selected'
            });
        }

        // Return the path relative to the server's public URL
        // stored as /media/filename.ext
        const fileUrl = `/media/${req.file.filename}`;

        res.status(200).json({
            success: true,
            fileUrl: fileUrl,
            fileName: req.file.filename,
            message: 'File uploaded successfully'
        });
    });
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
