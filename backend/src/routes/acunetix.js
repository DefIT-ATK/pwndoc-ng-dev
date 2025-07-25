var express = require('express');
var router = express.Router();
var axios = require('axios');
var https = require('https');
var Settings = require('../models/settings');

// Store authenticated sessions (in production, this should be in Redis or similar)
const authenticatedSessions = new Map();

// In-memory storage for export progress tracking
const exportProgressStore = new Map();

/**
 * Update export progress for a session
 */
function updateExportProgress(sessionKey, progressData) {
  console.log(`Updating progress for session ${sessionKey}:`, progressData);
  exportProgressStore.set(sessionKey, {
    ...progressData,
    timestamp: Date.now()
  });
}

/**
 * Get export progress for a session
 */
function getExportProgress(sessionKey) {
  return exportProgressStore.get(sessionKey) || null;
}

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

// Export vulnerabilities for a target group (full workflow with throttling and progress)
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

    // Load throttling configuration from settings
    let throttlingConfig;
    try {
      const settings = await Settings.getAll();
      throttlingConfig = settings.toolIntegrations?.acunetix?.throttling || {};
    } catch (error) {
      console.error('Failed to load settings, using defaults:', error);
      throttlingConfig = {};
    }

    // Configuration for throttling (from settings with fallback defaults)
    const CHUNK_SIZE = throttlingConfig.chunkSize || 500; // Vulnerabilities per batch
    const THROTTLE_DELAY = throttlingConfig.throttleDelay || 2000; // Delay between batches
    const REPORT_CHECK_INTERVAL = throttlingConfig.reportCheckInterval || 3000; // Report status check interval
    const MAX_REPORT_WAIT = throttlingConfig.maxReportWait || 120000; // Max wait per report

    console.log(`Using throttling config: chunkSize=${CHUNK_SIZE}, throttleDelay=${THROTTLE_DELAY}ms, reportCheckInterval=${REPORT_CHECK_INTERVAL}ms, maxReportWait=${MAX_REPORT_WAIT}ms`);

    // Initialize progress tracking
    updateExportProgress(sessionKey, {
      phase: 'starting',
      current: 0,
      total: 0,
      message: 'Initializing export...',
      batchInfo: null
    });

    // Step 1: Get all vulnerability IDs with progress tracking
    console.log(`Starting export for target group: ${targetGroupName || targetGroupId}`);
    updateExportProgress(sessionKey, {
      phase: 'fetching',
      current: 0,
      total: 0,
      message: 'Fetching vulnerabilities...',
      batchInfo: null
    });

    const vulns = [];
    let nextCursor = null;
    let pageCount = 0;

    while (true) {
      let url = `/api/v1/vulnerabilities?l=100&q=group_id:${targetGroupId};status:!ignored;status:!fixed;`;
      if (nextCursor) {
        url += `&c=${nextCursor}`;
      }

      pageCount++;
      console.log(`Fetching page ${pageCount} from: ${url}`);
      const response = await client.get(url);
      const data = response.data;

      vulns.push(...data.vulnerabilities);
      console.log(`Fetched ${data.vulnerabilities.length} vulnerabilities, total so far: ${vulns.length}`);

      // Handle pagination
      const cursors = data.pagination?.cursors || [];
      if (cursors.length > 1) {
        nextCursor = cursors[1];
        // Small delay between pages to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        break;
      }
    }

    const vulnIds = vulns.map(vuln => vuln.vuln_id);
    console.log(`Found ${vulnIds.length} total vulnerabilities across ${pageCount} pages`);

    if (vulnIds.length === 0) {
      updateExportProgress(sessionKey, {
        phase: 'completed',
        current: 0,
        total: 0,
        message: 'No vulnerabilities found',
        batchInfo: null
      });

      return res.json({
        success: true,
        message: 'No vulnerabilities found for this target group',
        reportData: null,
        progress: { phase: 'completed', current: 0, total: 0, message: 'No vulnerabilities found' }
      });
    }

    // Step 2: Split IDs into chunks
    const idChunks = [];
    for (let i = 0; i < vulnIds.length; i += CHUNK_SIZE) {
      idChunks.push(vulnIds.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Splitting vulnerability list into ${idChunks.length} batches (${CHUNK_SIZE} per batch)`);
    
    updateExportProgress(sessionKey, {
      phase: 'processing',
      current: 0,
      total: idChunks.length,
      message: `Processing ${vulnIds.length} vulnerabilities in ${idChunks.length} batches`,
      batchInfo: { totalVulns: vulnIds.length, batchSize: CHUNK_SIZE }
    });

    let mergedReport = null;

    // Step 3: Generate reports for each chunk with throttling
    for (let i = 0; i < idChunks.length; i++) {
      const idChunk = idChunks[i];
      console.log(`Processing batch ${i + 1}/${idChunks.length} with ${idChunk.length} vulnerabilities`);

      updateExportProgress(sessionKey, {
        phase: 'processing',
        current: i,
        total: idChunks.length,
        message: `Processing batch ${i + 1}/${idChunks.length} (${idChunk.length} vulnerabilities)`,
        batchInfo: { 
          totalVulns: vulnIds.length, 
          batchSize: CHUNK_SIZE,
          currentBatch: i + 1,
          batchVulns: idChunk.length
        }
      });

      // Throttle requests (except for the first batch)
      if (i > 0) {
        console.log(`Throttling: waiting ${THROTTLE_DELAY}ms before next batch...`);
        updateExportProgress(sessionKey, {
          phase: 'throttling',
          current: i,
          total: idChunks.length,
          message: `Waiting ${THROTTLE_DELAY / 1000}s before processing batch ${i + 1}/${idChunks.length}`,
          batchInfo: { 
            totalVulns: vulnIds.length, 
            batchSize: CHUNK_SIZE,
            currentBatch: i + 1,
            batchVulns: idChunk.length
          }
        });
        await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
      }

      // Generate report for this chunk
      updateExportProgress(sessionKey, {
        phase: 'generating_report',
        current: i,
        total: idChunks.length,
        message: `Generating report for batch ${i + 1}/${idChunks.length}`,
        batchInfo: { 
          totalVulns: vulnIds.length, 
          batchSize: CHUNK_SIZE,
          currentBatch: i + 1,
          batchVulns: idChunk.length
        }
      });

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

      // Wait for the report to be ready with configurable timing
      updateExportProgress(sessionKey, {
        phase: 'waiting_report',
        current: i,
        total: idChunks.length,
        message: `Waiting for report generation (batch ${i + 1}/${idChunks.length})`,
        batchInfo: { 
          totalVulns: vulnIds.length, 
          batchSize: CHUNK_SIZE,
          currentBatch: i + 1,
          batchVulns: idChunk.length,
          reportId
        }
      });

      let downloadLink = null;
      let attempts = 0;
      const maxAttempts = Math.ceil(MAX_REPORT_WAIT / REPORT_CHECK_INTERVAL);

      while (!downloadLink && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, REPORT_CHECK_INTERVAL));
        attempts++;

        console.log(`Checking report status for batch ${i + 1}, attempt ${attempts}/${maxAttempts}`);
        const statusResponse = await client.get(`/api/v1/exports/${reportId}`);
        const downloadLinks = statusResponse.data.download || [];
        
        if (downloadLinks.length > 0 && downloadLinks[0] !== null) {
          downloadLink = downloadLinks[0];
          console.log(`Report ready for batch ${i + 1}, download link: ${downloadLink}`);
          break;
        }
      }

      if (!downloadLink) {
        throw new Error(`Report generation timed out for batch ${i + 1} after ${Math.round(MAX_REPORT_WAIT / 1000)} seconds`);
      }

      // Download the report JSON
      updateExportProgress(sessionKey, {
        phase: 'downloading',
        current: i,
        total: idChunks.length,
        message: `Downloading report data (batch ${i + 1}/${idChunks.length})`,
        batchInfo: { 
          totalVulns: vulnIds.length, 
          batchSize: CHUNK_SIZE,
          currentBatch: i + 1,
          batchVulns: idChunk.length
        }
      });

      console.log(`Downloading report data for batch ${i + 1}/${idChunks.length}`);
      const reportResponse = await client.get(downloadLink);
      const reportJson = reportResponse.data;

      // Merge reports
      if (i === 0) {
        // First chunk - initialize merged report
        mergedReport = reportJson;
        console.log(`Batch 1/${idChunks.length} completed - ${idChunk.length} vulnerabilities processed`);
      } else {
        // Subsequent chunks - append scans to merged report
        if (mergedReport.export && mergedReport.export.scans && reportJson.export && reportJson.export.scans) {
          mergedReport.export.scans.push(...reportJson.export.scans);
        }
        console.log(`Batch ${i + 1}/${idChunks.length} completed - ${idChunk.length} vulnerabilities processed`);
      }

      updateExportProgress(sessionKey, {
        phase: 'processing',
        current: i + 1,
        total: idChunks.length,
        message: `Completed batch ${i + 1}/${idChunks.length} (${idChunk.length} vulnerabilities)`,
        batchInfo: { 
          totalVulns: vulnIds.length, 
          batchSize: CHUNK_SIZE,
          currentBatch: i + 1,
          batchVulns: idChunk.length
        }
      });
    }

    console.log(`Export completed successfully: ${vulnIds.length} vulnerabilities processed in ${idChunks.length} batches`);
    
    updateExportProgress(sessionKey, {
      phase: 'completed',
      current: idChunks.length,
      total: idChunks.length,
      message: `Export completed: ${vulnIds.length} vulnerabilities processed`,
      batchInfo: { 
        totalVulns: vulnIds.length, 
        batchSize: CHUNK_SIZE,
        totalBatches: idChunks.length
      }
    });
    
    res.json({
      success: true,
      message: `Successfully exported ${vulnIds.length} vulnerabilities from ${targetGroupName || targetGroupId}`,
      reportData: mergedReport,
      totalVulnerabilities: vulnIds.length,
      batches: idChunks.length,
      progress: { 
        phase: 'completed', 
        current: idChunks.length, 
        total: idChunks.length, 
        message: `Export completed: ${vulnIds.length} vulnerabilities processed` 
      }
    });
    
  } catch (error) {
    console.error('Failed to export target group:', error.response?.data || error.message);
    
    // Update progress to show error state
    updateExportProgress(sessionKey, {
      phase: 'error',
      current: 0,
      total: 0,
      message: `Export failed: ${error.message}`,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to export target group'
    });
  }
});

// Get export configuration settings
router.get('/export-config', async (req, res) => {
  try {
    const settings = await Settings.getAll();
    const throttlingConfig = settings.toolIntegrations?.acunetix?.throttling || {};
    
    res.json({
      success: true,
      config: {
        chunkSize: throttlingConfig.chunkSize || 500,
        throttleDelay: throttlingConfig.throttleDelay || 2000,
        reportCheckInterval: throttlingConfig.reportCheckInterval || 3000,
        maxReportWait: throttlingConfig.maxReportWait || 120000
      }
    });
  } catch (error) {
    console.error('Failed to get export config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get export configuration'
    });
  }
});

// Get export progress
router.get('/export-progress/:sessionKey', (req, res) => {
  try {
    const { sessionKey } = req.params;
    
    // URL decode the session key to handle special characters
    const decodedSessionKey = decodeURIComponent(sessionKey);
    console.log('Progress request for session:', decodedSessionKey);
    
    if (!decodedSessionKey) {
      return res.status(400).json({
        success: false,
        message: 'Session key required'
      });
    }

    const progress = getExportProgress(decodedSessionKey);
    console.log('Progress data found:', progress);
    
    if (!progress) {
      console.log('No progress data available for session:', decodedSessionKey);
      return res.json({
        success: true,
        progress: null,
        message: 'No export in progress'
      });
    }

    console.log('Returning progress:', progress);
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Failed to get export progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get export progress'
    });
  }
});

module.exports = router;
