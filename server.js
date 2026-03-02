const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs'); // <-- ADD THIS MISSING IMPORT!
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'https://dark-pattern-detector.onrender.com/api/v1';

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Proxy endpoints
app.post('/api/detect', async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/detect`, req.body, {
            timeout: 30000 // 30 second timeout
        });
        res.json(response.data);
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.detail || 'Failed to analyze',
            details: error.message
        });
    }
});

// Screenshot upload endpoint
app.post('/api/detect/screenshot', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('File received:', req.file.path);

        // Create FormData and append the file
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        // Send to backend API
        const response = await axios.post(`${API_URL}/detect/screenshot`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Accept': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000 // 60 second timeout for large files
        });

        // Clean up temp file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
            else console.log('Temp file deleted:', req.file.path);
        });

        res.json(response.data);

    } catch (error) {
        console.error('Screenshot error:', error.message);
        
        // Clean up temp file on error
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        
        // Send appropriate error response
        if (error.response) {
            // Backend API responded with error
            res.status(error.response.status).json({
                error: error.response.data?.detail || 'Backend analysis failed',
                details: error.message
            });
        } else if (error.request) {
            // No response from backend
            res.status(503).json({
                error: 'Backend service unavailable',
                details: error.message
            });
        } else {
            // Something else went wrong
            res.status(500).json({
                error: 'Screenshot analysis failed',
                details: error.message
            });
        }
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/health`);
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ status: 'disconnected', error: error.message });
    }
});

app.get('/api/patterns', async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/patterns`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patterns' });
    }
});

// Serve HTML for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Frontend server running at http://localhost:${PORT}`);
    console.log(`📡 API proxy configured to: ${API_URL}`);
});