import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const uploadFile = async () => {
    try {
        const form = new FormData();
        if (!fs.existsSync('test_media_upload.txt')) {
            fs.writeFileSync('test_media_upload.txt', 'This is a test media upload file');
        }

        form.append('file', fs.createReadStream('test_media_upload.txt'));

        console.log('Attempting upload to /api/media/upload...');
        const response = await axios.post('http://localhost:5000/api/media/upload', form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        console.log('Upload successful:', response.data);

        if (response.data.url) {
            const fileUrl = 'http://localhost:5000' + response.data.url;
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
