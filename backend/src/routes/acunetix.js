var express = require('express');
var router = express.Router();
var axios = require('axios');
var https = require('https');

// Store authenticated sessions (in production, this should be in Redis or similar)
const authenticatedSessions = new Map();

// Debug route to see what headers we receive
router.get('/debug-headers', (req, res) => {
  res.json({
    headers: req.headers,
    query: req.query
  });
});

// Create axios instance with SSL verification disabled
const createAcunetixClient = (serverAddress) => {
  return axios.create({
    baseURL: serverAddress.replace(/\/$/, ''), // Remove trailing slash
    timeout: 10000, // 10 second timeout instead of 30 seconds
    httpsAgent: new https.Agent({
      rejectUnauthorized: false // Equivalent to verify=False in Python
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

// Authenticate with Acunetix
router.post('/auth', async (req, res) => {
  try {
    const { serverAddress, email, password } = req.body;
    
    if (!serverAddress || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    const client = createAcunetixClient(serverAddress);
    
    const authData = {
      email: email,
      password: password,
      remember_me: true,
      logout_previous: true
    };

    console.log('Authenticating with Acunetix...');
    const response = await client.post('/api/v1/me/login', authData);
    
    console.log('Acunetix auth response headers:', JSON.stringify(response.headers, null, 2));
    console.log('Acunetix auth response status:', response.status);
    
    // Create an authenticated client that mimics Python requests.Session behavior
    const authenticatedClient = createAcunetixClient(serverAddress);
    
    // Extract only authentication-related headers from response
    // In Python requests.Session, cookies are handled separately and other response headers
    // are not blindly sent as request headers
    const authHeaders = {};
    
    // Extract authentication headers (x-auth, x-acxv) - these are the key ones
    Object.keys(response.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith('x-') && (lowerKey.includes('auth') || lowerKey.includes('acx'))) {
        authHeaders[key] = response.headers[key];
      }
    });
    
    // Also extract any cookies from Set-Cookie header and apply them properly
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      // Extract cookie values and set them in the client
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      const cookieString = cookies.map(cookie => {
        // Extract just the name=value part, ignore the rest
        const cookiePart = cookie.split(';')[0];
        return cookiePart;
      }).join('; ');
      
      if (cookieString) {
        authHeaders['Cookie'] = cookieString;
      }
    }
    
    // Update the client headers with only the necessary auth headers
    Object.keys(authHeaders).forEach(key => {
      authenticatedClient.defaults.headers[key] = authHeaders[key];
    });
    
    console.log('Updated client with auth headers:', JSON.stringify(authHeaders, null, 2));
    
    // Create a session key for this authentication
    const sessionKey = `${serverAddress}-${email}-${Date.now()}`;
    
    // Store the authenticated client
    authenticatedSessions.set(sessionKey, {
      client: authenticatedClient,
      serverAddress: serverAddress,
      createdAt: Date.now()
    });
    
    // Test the session immediately to see if it works
    try {
      console.log('Testing session immediately after login...');
      const testResponse = await authenticatedClient.get('/api/v1/target_groups?q=name:*');
      console.log('Immediate test successful! Session is working.');
      console.log('Test response data:', JSON.stringify(testResponse.data, null, 2));
    } catch (testError) {
      console.error('Immediate test failed:', testError.response?.status, testError.response?.data);
    }
    
    res.json({
      success: true,
      sessionKey: sessionKey, // Send session key instead of individual headers
      data: response.data
    });
    
  } catch (error) {
    console.error('Acunetix authentication failed:', error.response?.data || error.message);
    
    // Handle different types of errors more specifically
    let errorMessage = 'Authentication failed';
    let statusCode = 500;
    
    if (error.code === 'ENOTFOUND') {
      errorMessage = `Cannot resolve hostname: ${error.hostname}. Please check the server address.`;
      statusCode = 400;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused. Please check if the Acunetix server is running and accessible.`;
      statusCode = 400;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      errorMessage = `Connection timeout. Please check the server address and network connectivity.`;
      statusCode = 400;
    } else if (error.response?.status === 401) {
      errorMessage = `Invalid credentials. Please check your email and password.`;
      statusCode = 401;
    } else if (error.response?.status === 403) {
      errorMessage = `Access forbidden. Please check your account permissions.`;
      statusCode = 403;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
      statusCode = error.response.status || 500;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      code: error.code,
      details: error.response?.data
    });
  }
});

// Get target groups
router.get('/target-groups', async (req, res) => {
  try {
    const { serverAddress, sessionKey } = req.query;
    
    console.log('Target groups request - serverAddress:', serverAddress);
    console.log('Target groups request - sessionKey:', sessionKey);
    console.log('Target groups request - timestamp:', new Date().toISOString());
    
    if (!serverAddress || !sessionKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing serverAddress or sessionKey parameter' 
      });
    }

    // Get the authenticated session
    const session = authenticatedSessions.get(sessionKey);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please authenticate again.'
      });
    }

    const client = session.client;
    
    console.log('Using stored authenticated client');
    console.log('Client headers:', JSON.stringify(client.defaults.headers, null, 2));
    
    console.log('Making request to:', '/api/v1/target_groups?q=name:*');
    const response = await client.get('/api/v1/target_groups?q=name:*');
    
    console.log('Acunetix response status:', response.status);
    console.log('Acunetix response data:', JSON.stringify(response.data, null, 2));
    
    res.json({
      success: true,
      groups: response.data.groups || []
    });
    
  } catch (error) {
    console.error('Failed to get target groups - full error:', error);
    console.error('Error response data:', error.response?.data);
    console.error('Error response status:', error.response?.status);
    console.error('Error response headers:', error.response?.headers);
    
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get target groups',
      details: error.response?.data || error.message
    });
  }
});

// Get vulnerability IDs for a target group
router.post('/vulnerabilities', async (req, res) => {
  try {
    const { serverAddress, sessionKey, targetGroupId } = req.body;
    
    if (!serverAddress || !sessionKey || !targetGroupId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Get the authenticated session
    const session = authenticatedSessions.get(sessionKey);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please authenticate again.'
      });
    }

    const client = session.client;
    const vulns = [];
    let nextCursor = null;

    console.log(`Getting vulnerability IDs for target group: ${targetGroupId}`);

    while (true) {
      let url = `/api/v1/vulnerabilities?l=100&q=group_id:${targetGroupId};status:!ignored;status:!fixed;`;
      if (nextCursor) {
        url += `&c=${nextCursor}`;
      }

      console.log(`Fetching vulnerabilities from: ${url}`);
      const response = await client.get(url);
      const data = response.data;

      vulns.push(...data.vulnerabilities);
      console.log(`Fetched ${data.vulnerabilities.length} vulnerabilities, total so far: ${vulns.length}`);

      // Handle pagination
      const cursors = data.pagination?.cursors || [];
      if (cursors.length > 1) {
        nextCursor = cursors[1]; // Second item is the "next" cursor
        console.log(`Next cursor: ${nextCursor}`);
      } else {
        console.log('No more pages');
        break; // Exit if there's no next cursor
      }
    }

    // Extract vulnerability IDs
    const vulnIds = vulns.map(vuln => vuln.vuln_id);
    console.log(`Found ${vulnIds.length} total vulnerabilities`);
    
    res.json({
      success: true,
      vulnerabilityIds: vulnIds,
      totalCount: vulnIds.length
    });
    
  } catch (error) {
    console.error('Failed to get vulnerability IDs:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get vulnerability IDs'
    });
  }
});

// Generate export report
router.post('/export', async (req, res) => {
  try {
    const { serverAddress, sessionKey, vulnerabilityIds } = req.body;
    
    if (!serverAddress || !sessionKey || !vulnerabilityIds) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Get the authenticated session
    const session = authenticatedSessions.get(sessionKey);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please authenticate again.'
      });
    }

    const client = session.client;

    const exportData = {
      export_id: "21111111-1111-1111-1111-111111111130",
      source: {
        list_type: "vulnerabilities",
        id_list: vulnerabilityIds
      }
    };

    console.log(`Generating export for ${vulnerabilityIds.length} vulnerabilities`);
    const response = await client.post('/api/v1/exports', exportData);
    
    res.json({
      success: true,
      reportId: response.data.report_id
    });
    
  } catch (error) {
    console.error('Failed to generate report:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to generate report'
    });
  }
});

// Check report status and get download link
router.post('/report-status', async (req, res) => {
  try {
    const { serverAddress, sessionKey, reportId } = req.body;
    
    if (!serverAddress || !sessionKey || !reportId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Get the authenticated session
    const session = authenticatedSessions.get(sessionKey);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please authenticate again.'
      });
    }

    const client = session.client;

    const response = await client.get(`/api/v1/exports/${reportId}`);
    const downloadLinks = response.data.download || [];
    
    res.json({
      success: true,
      downloadLink: downloadLinks.length > 0 && downloadLinks[0] !== null ? downloadLinks[0] : null
    });
    
  } catch (error) {
    console.error('Failed to get report status:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get report status'
    });
  }
});

// Download report
router.post('/download', async (req, res) => {
  try {
    const { serverAddress, sessionKey, downloadLink } = req.body;
    
    if (!serverAddress || !sessionKey || !downloadLink) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Get the authenticated session
    const session = authenticatedSessions.get(sessionKey);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please authenticate again.'
      });
    }

    const client = session.client;

    const response = await client.get(downloadLink);
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('Failed to download report:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to download report'
    });
  }
});

// Export vulnerabilities for a target group (full workflow like Python script)
router.post('/export-target-group', async (req, res) => {
  try {
    const { serverAddress, sessionKey, targetGroupId, targetGroupName } = req.body;
    
    if (!serverAddress || !sessionKey || !targetGroupId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Get the authenticated session
    const session = authenticatedSessions.get(sessionKey);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please authenticate again.'
      });
    }

    const client = session.client;

    // Step 1: Get all vulnerability IDs
    console.log(`Starting export for target group: ${targetGroupName || targetGroupId}`);
    const vulns = [];
    let nextCursor = null;

    while (true) {
      let url = `/api/v1/vulnerabilities?l=100&q=group_id:${targetGroupId};status:!ignored;status:!fixed;`;
      if (nextCursor) {
        url += `&c=${nextCursor}`;
      }

      console.log(`Fetching vulnerabilities from: ${url}`);
      const response = await client.get(url);
      const data = response.data;

      vulns.push(...data.vulnerabilities);
      console.log(`Fetched ${data.vulnerabilities.length} vulnerabilities, total so far: ${vulns.length}`);

      // Handle pagination
      const cursors = data.pagination?.cursors || [];
      if (cursors.length > 1) {
        nextCursor = cursors[1];
      } else {
        break;
      }
    }

    const vulnIds = vulns.map(vuln => vuln.vuln_id);
    console.log(`Found ${vulnIds.length} total vulnerabilities`);

    if (vulnIds.length === 0) {
      return res.json({
        success: true,
        message: 'No vulnerabilities found for this target group',
        reportData: null
      });
    }

    // Step 2: Split IDs into chunks of 500
    const chunkSize = 500;
    const idChunks = [];
    for (let i = 0; i < vulnIds.length; i += chunkSize) {
      idChunks.push(vulnIds.slice(i, i + chunkSize));
    }

    console.log(`Splitting vulnerability list into ${idChunks.length} batches`);

    let mergedReport = null;

    // Step 3: Generate reports for each chunk and merge them
    for (let i = 0; i < idChunks.length; i++) {
      const idChunk = idChunks[i];
      console.log(`Processing batch ${i + 1}/${idChunks.length} with ${idChunk.length} vulnerabilities`);

      // Generate report for this chunk
      const exportData = {
        export_id: "21111111-1111-1111-1111-111111111130",
        source: {
          list_type: "vulnerabilities",
          id_list: idChunk
        }
      };

      const exportResponse = await client.post('/api/v1/exports', exportData);
      const reportId = exportResponse.data.report_id;
      console.log(`Generated report ID: ${reportId}`);

      // Wait for the report to be ready
      let downloadLink = null;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max (5 seconds * 60)

      while (!downloadLink && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;

        console.log(`Checking report status, attempt ${attempts}/${maxAttempts}`);
        const statusResponse = await client.get(`/api/v1/exports/${reportId}`);
        const downloadLinks = statusResponse.data.download || [];
        
        if (downloadLinks.length > 0 && downloadLinks[0] !== null) {
          downloadLink = downloadLinks[0];
          console.log(`Report ready, download link: ${downloadLink}`);
          break;
        }
      }

      if (!downloadLink) {
        throw new Error(`Report generation timed out for batch ${i + 1}`);
      }

      // Download the report JSON
      console.log(`Downloading report data for batch ${i + 1}`);
      const reportResponse = await client.get(downloadLink);
      const reportJson = reportResponse.data;

      // Merge reports
      if (i === 0) {
        // First chunk - initialize merged report
        mergedReport = reportJson;
        console.log(`Batch 1/${idChunks.length} completed`);
      } else {
        // Subsequent chunks - append scans to merged report
        if (mergedReport.export && mergedReport.export.scans && reportJson.export && reportJson.export.scans) {
          mergedReport.export.scans.push(...reportJson.export.scans);
        }
        console.log(`Batch ${i + 1}/${idChunks.length} completed`);
      }
    }

    console.log('Export completed successfully');
    
    res.json({
      success: true,
      message: `Successfully exported ${vulnIds.length} vulnerabilities from ${targetGroupName || targetGroupId}`,
      reportData: mergedReport,
      totalVulnerabilities: vulnIds.length,
      batches: idChunks.length
    });
    
  } catch (error) {
    console.error('Failed to export target group:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to export target group'
    });
  }
});

module.exports = router;
