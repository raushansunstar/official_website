import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const uploadFile = async () => {
    try {
        const form = new FormData();
        // Create a dummy file if it doesn't exist
        if (!fs.existsSync('test_upload_v3.txt')) {
            fs.writeFileSync('test_upload_v3.txt', 'This is a test upload file v3');
        }

        form.append('file', fs.createReadStream('test_upload_v3.txt'));

        console.log('Attempting upload to /api/digital-assets/upload...');
        const response = await axios.post('http://localhost:5000/api/digital-assets/upload', form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        console.log('Upload successful:', response.data);

        // Verify file access
        if (response.data.fileUrl) {
            const fileUrl = 'http://localhost:5000' + response.data.fileUrl;
            console.log(`Verifying access to: ${fileUrl}`);
            try {
                const fileRes = await axios.get(fileUrl);
                if (fileRes.status === 200) {
                    console.log('✅ File is accessible!');
                }
            } catch (err) {
                console.error('❌ Failed to access file:', err.message);
            }
        }

    } catch (error) {
        console.error('Upload failed:', error.response ? error.response.data : error.message);
    }
};

uploadFile();
