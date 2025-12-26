import cloudinary from 'cloudinary';
import dotenv from 'dotenv';
import multer from 'multer';
import asyncHandler from 'express-async-handler';
import sharp from 'sharp';
import express from 'express';

// Load environment variables from .env file
dotenv.config();

// Cloudinary configuration
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Create multer upload instances for different field names
// This helps handle both 'image' and 'images' field names
const uploadMultiple = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/svg+xml' ||

      file.mimetype === 'image/webp' ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, PDF and Docs are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // ✅ Max 10MB per file
    files: 5                   // ✅ Max 5 total files across all fields
  }
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'image', maxCount: 5 }
]);


// Choose output format based on input and preference
const determineOutputFormat = (mimetype, prefer = 'auto') => {
  // prefer: 'auto' (keep alpha if present -> use webp if available), 'png', 'webp', 'jpeg'
  if (prefer === 'png') return 'png';
  if (prefer === 'webp') return 'webp';
  if (prefer === 'jpeg') return 'jpg';

  // auto: preserve alpha -> webp if alpha else jpeg
  if (mimetype === 'image/png' || mimetype === 'image/webp' || mimetype === 'image/svg+xml') {
    // png/webp may have alpha; prefer webp to save size while keeping alpha
    return 'webp';
  }
  return 'jpg';
};

const optimizeImage = async (buffer, mimetype, options = {}) => {
  // options: { maxWidth, maxHeight, preferFormat: 'auto'|'png'|'webp'|'jpeg', jpegQuality, webpQuality, pngCompression }
  const {
    maxWidth = 1280,
    maxHeight = 720,
    preferFormat = 'auto',
    jpegQuality = 65,
    webpQuality = 70,
    pngCompression = 8,
    flattenToWhite = false // if true, convert transparent to white for jpg
  } = options;

  const img = sharp(buffer).resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true });

  const meta = await img.metadata();
  const hasAlpha = !!meta.hasAlpha;
  const desired = determineOutputFormat(mimetype, preferFormat);

  // If user explicitly wants jpeg and image had alpha and they want white bg:
  if (desired === 'jpg' || desired === 'jpeg') {
    if (hasAlpha && flattenToWhite) {
      // Replace transparency with white background before jpeg conversion
      return img.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: jpegQuality, progressive: true }).toBuffer();
    } else {
      // If hasAlpha and flattenToWhite is false, alpha will be lost and may become black; so better to fallback to webp/png
      if (hasAlpha) {
        // fallback to webp to preserve alpha
        return img.webp({ quality: webpQuality }).toBuffer();
      }
      return img.jpeg({ quality: jpegQuality, progressive: true }).toBuffer();
    }
  }

  if (desired === 'png') {
    // Keep alpha, good for transparency
    return img.png({ compressionLevel: pngCompression }).toBuffer();
  }

  // default -> webp (good size + supports alpha)
  return img.webp({ quality: webpQuality }).toBuffer();
};

// Universal image upload handler that works with different field names
export const uploadImages = asyncHandler(async (req, res) => {
  uploadMultiple(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      // Handle file uploads from either the 'images' or 'image' field
      const files = [];

      // Add files from 'images' field if it exists
      if (req.files && req.files.images) {
        files.push(...req.files.images);
      }

      // Add files from 'image' field if it exists
      if (req.files && req.files.image) {
        files.push(...req.files.image);
      }

      // Handle single file uploaded with wrong field name
      if (req.file) {
        files.push(req.file);
      }

      if (files.length === 0) {
        return res.status(400).json({ success: false, message: 'No images provided' });
      }

      console.log(`Processing ${files.length} files`);

      // Process images in smaller batches
      const batchSize = 3;
      const imageUrls = [];

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        const batchPromises = batch.map(async (file) => {
          const isImage = file.mimetype.startsWith('image/');
          let uploadBuffer = file.buffer;

          // Only optimize if it's an image
          if (isImage) {
            try {
              uploadBuffer = await optimizeImage(file.buffer, file.mimetype);
            } catch (optErr) {
              console.warn("Image optimization failed, using original buffer", optErr);
            }
          }

          return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.v2.uploader.upload_stream(
              {
                folder: 'hotel_images',
                resource_type: isImage ? 'image' : 'raw', // Explicitly use 'raw' for docs to prevent "image" processing errors
                use_filename: true, // Try to preserve filename
                public_id: isImage ? undefined : file.originalname.split('.')[0], // For raw, using filename is standard
                // format: isImage ? 'jpg' : undefined, // REMOVED: Do not force JPG, allow PNG/WebP for transparency
                quality: isImage ? 'auto' : undefined, // changed auto:low to auto for better quality with transparency
              },
              (error, result) => {
                if (error) {
                  console.error('Cloudinary upload error:', error);
                  reject(error);
                } else {
                  resolve(result.secure_url);
                }
              }
            );
            uploadStream.end(uploadBuffer);
          });
        });

        const batchUrls = await Promise.all(batchPromises);
        imageUrls.push(...batchUrls);
      }

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=31536000',
        'Expires': new Date(Date.now() + 31536000000).toUTCString()
      });

      res.status(201).json({
        success: true,
        message: 'Images uploaded successfully',
        imageUrls,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading images',
        error: error.message,
      });
    }
  });
});

