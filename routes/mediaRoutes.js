import path from 'path';
import fs from 'fs';
import { Router } from 'express';
const router = Router();

const __dirname = path.resolve();
const MEDIA_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

router.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, msg: 'No file uploaded' });
    }

    const file = req.files.file;

    // validate type
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ success: false, msg: 'Only image, PDF, and document files are allowed' });
    }

    // generate filename
    const ext = path.extname(file.name).toLowerCase();
    const safeBase = path.basename(file.name, ext).replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safeBase}${ext}`;

    // move file
    const dest = path.join(MEDIA_DIR, filename);
    await file.mv(dest);

    // build public URL
    // Use /api/media/ prefix to match server static serve
    const url = `/api/media/${filename}`;

    res.json({ ok: true, url, path: `/api/media/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: 'Something went wrong', err: err.message });
  }
});


export default router;
