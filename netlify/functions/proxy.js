// netlify/functions/proxy.js
const axios = require('axios');
const FormData = require('form-data');
const multipart = require('parse-multipart');

const API_URL = process.env.API_URL || 'https://dark-pattern-detector.onrender.com/api/v1';

exports.handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/proxy/', '');
  const method = event.httpMethod;
  
  console.log(`📡 [${method}] ${path}`);
  
  try {
    // Handle different endpoints
    if (path === 'detect' && method === 'POST') {
      return await handleDetect(event);
    } else if (path === 'detect/screenshot' && method === 'POST') {
      return await handleScreenshot(event);
    } else if (path === 'health') {
      return await handleHealth();
    } else if (path === 'patterns') {
      return await handlePatterns();
    }
    
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Endpoint not found' })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

// Handle /detect endpoint
async function handleDetect(event) {
  try {
    const body = JSON.parse(event.body);
    
    const response = await axios.post(`${API_URL}/detect`, body, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return handleError(error);
  }
}

// Handle /detect/screenshot endpoint
async function handleScreenshot(event) {
  try {
    // Parse multipart form data
    const boundary = multipart.getBoundary(event.headers['content-type']);
    const parts = multipart.Parse(Buffer.from(event.body, 'base64'), boundary);
    
    const filePart = parts.find(part => part.name === 'file');
    
    if (!filePart) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file uploaded' })
      };
    }
    
    // Create FormData for backend
    const formData = new FormData();
    formData.append('file', filePart.data, {
      filename: filePart.filename || 'screenshot.png',
      contentType: filePart.type
    });
    
    const response = await axios.post(`${API_URL}/detect/screenshot`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return handleError(error);
  }
}

// Handle /health endpoint
async function handleHealth() {
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        frontend: 'healthy',
        backend: response.data,
        api_url: API_URL,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        frontend: 'healthy',
        backend: 'disconnected',
        error: error.message,
        api_url: API_URL
      })
    };
  }
}

// Handle /patterns endpoint
async function handlePatterns() {
  try {
    const response = await axios.get(`${API_URL}/patterns`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return handleError(error);
  }
}

// Error handler
function handleError(error) {
  console.error('API Error:', error.message);
  
  if (error.response) {
    return {
      statusCode: error.response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Backend error',
        details: error.response.data,
        status: error.response.status
      })
    };
  } else if (error.request) {
    return {
      statusCode: 504,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Backend timeout',
        details: 'No response from backend',
        api_url: API_URL
      })
    };
  } else {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Request failed',
        details: error.message
      })
    };
  }
}