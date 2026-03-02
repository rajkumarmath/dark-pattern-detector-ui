// server.js
const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Use environment variable for API URL
const API_URL = process.env.API_URL || 'https://dark-pattern-detector.onrender.com/api/v1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

console.log('🚀 Starting Dark Pattern Detector Frontend');
console.log('==========================================');
console.log('🌍 Environment:', IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT');
console.log('📡 Backend API URL:', API_URL);
console.log('🔌 Port:', PORT);
console.log('==========================================');

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: IS_PRODUCTION ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "*"],
            connectSrc: ["'self'", API_URL, "https://*.onrender.com"],
        },
    } : false,
}));

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// CORS configuration
app.use(cors({
    origin: IS_PRODUCTION ? [
        'https://dark-pattern-detector-ui.vercel.app',
        'https://dark-pattern-detector-ui.netlify.app',
        'http://localhost:3000',
        'http://localhost:5173'
    ] : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));
app.use('/api', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for frontend
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: IS_PRODUCTION ? 'production' : 'development',
        api_url: API_URL
    });
});

// API Proxy endpoints
app.post('/api/detect', async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('📤 [POST] /api/detect - Forwarding to backend');
        console.log('   Request body:', JSON.stringify(req.body).substring(0, 200));
        
        const response = await axios.post(`${API_URL}/detect`, req.body, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Backend response received in ${duration}ms`);
        console.log(`   Status: ${response.status}`);
        
        res.json(response.data);
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ API Error after ${duration}ms:`, error.message);
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Backend service is not available',
                details: 'Could not connect to backend server',
                api_url: API_URL,
                tip: 'Make sure your backend is running on Render'
            });
        }
        
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({
                error: 'Backend timeout',
                details: 'The request took too long to complete',
                timeout: '30s'
            });
        }
        
        if (error.response) {
            // Backend responded with error
            console.error('   Backend error status:', error.response.status);
            console.error('   Backend error data:', error.response.data);
            return res.status(error.response.status).json({
                error: 'Backend analysis failed',
                details: error.response.data?.detail || error.response.data,
                status: error.response.status
            });
        } else if (error.request) {
            // No response received
            return res.status(504).json({
                error: 'No response from backend',
                details: 'The backend server did not respond',
                api_url: API_URL
            });
        } else {
            // Something else
            return res.status(500).json({
                error: 'Request failed',
                details: error.message
            });
        }
    }
});

// Screenshot upload endpoint
app.post('/api/detect/screenshot', upload.single('file'), async (req, res) => {
    const startTime = Date.now();
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('📸 [POST] /api/detect/screenshot - Processing upload');
        console.log(`   File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
        console.log(`   Type: ${req.file.mimetype}`);
        console.log('📤 Forwarding to backend:', `${API_URL}/detect/screenshot`);

        // Create FormData and append the file
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

        const duration = Date.now() - startTime;
        console.log(`✅ Screenshot analysis complete in ${duration}ms`);

        // Clean up temp file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('⚠️ Error deleting temp file:', err.message);
            else console.log('🧹 Temp file deleted:', req.file.path);
        });

        res.json(response.data);

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Screenshot error after ${duration}ms:`, error.message);
        
        // Clean up temp file on error
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Backend service is not available',
                details: 'Could not connect to backend server',
                api_url: API_URL
            });
        }
        
        if (error.response) {
            // Backend API responded with error
            console.error('   Backend error:', error.response.data);
            res.status(error.response.status).json({
                error: 'Backend analysis failed',
                details: error.response.data?.detail || error.response.data,
                status: error.response.status
            });
        } else if (error.request) {
            // No response from backend
            res.status(504).json({
                error: 'No response from backend',
                details: 'The backend server did not respond',
                api_url: API_URL
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

// Backend health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        console.log('🩺 Checking backend health:', `${API_URL}/health`);
        const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
        
        res.json({ 
            frontend: {
                status: 'healthy',
                version: '1.0.0',
                environment: IS_PRODUCTION ? 'production' : 'development'
            },
            backend: response.data,
            api_url: API_URL,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Backend health check failed:', error.message);
        res.status(503).json({ 
            frontend: {
                status: 'healthy',
                version: '1.0.0'
            },
            backend: {
                status: 'disconnected',
                error: error.message
            },
            api_url: API_URL,
            timestamp: new Date().toISOString()
        });
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
    console.error('🔥 Server error:', err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err);
});

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 SERVER IS RUNNING!');
    console.log('='.repeat(50));
    console.log(`📍 Local URL: http://localhost:${PORT}`);
    console.log(`📡 API Proxy: ${API_URL}`);
    console.log(`🌍 Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
    console.log('='.repeat(50) + '\n');
});
