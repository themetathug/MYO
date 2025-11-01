# 🧪 Complete Testing Guide - UK Job Tracker

## Prerequisites Checklist

### 1. Backend Server
- ✅ Backend running on `http://localhost:3001`
- ✅ Database (PostgreSQL) is running and connected
- ✅ Test: Visit `http://localhost:3001/health` - should return `{"status":"healthy"}`

### 2. Frontend Server  
- ✅ Frontend running (could be on 3000, 3001, 3002, or 3003)
- ✅ Test: Visit your frontend URL - should show login/register page

### 3. Chrome Extension
- ✅ Extension installed and enabled
- ✅ Reloaded after code changes

---

## Step-by-Step Testing Workflow

### 🔐 Step 1: Authentication Setup

1. **Open Frontend**:
   - Go to `http://localhost:3002` (or your frontend port)
   
2. **Register/Login**:
   - If new user: Click "Register" → Enter email/password → Register
   - If existing: Click "Login" → Enter credentials → Login
   
3. **Verify Token**:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Type: `localStorage.getItem('token')`
   - Should show a long JWT token string
   - If null/undefined: Login failed - check backend logs

### 🔄 Step 2: Sync Extension Token

1. **Open Extension Popup**:
   - Click the extension icon in Chrome toolbar
   
2. **Check Token Status**:
   - Look for token status message at top of popup
   - Should say: `✅ Authenticated - Ready to save jobs!`
   - If says `⚠️ Not authenticated`:
   
3. **Sync Token Manually**:
   - Click "🔄 Sync Token" button in popup
   - Should change to `✅ Token synced successfully!`
   - If fails:
     - Make sure frontend tab is open
     - Try refreshing frontend page
     - Check browser console for errors

### 📋 Step 3: Test Single Job Capture (Job Detail Page)

1. **Navigate to a Job Page**:
   - Go to LinkedIn: `https://www.linkedin.com/jobs/view/[JOB_ID]`
   - Or Indeed: `https://www.indeed.com/viewjob?jk=[JOB_ID]`
   - Or any company careers page with a job posting

2. **Extension Auto-Detection**:
   - Wait 2-3 seconds after page loads
   - Should see notification: `✅ Job details captured successfully!`
   - If not, check console (F12) for errors

3. **Manual Capture via Popup**:
   - Click extension icon
   - Popup should show filled form with:
     - Company name
     - Position/title
     - Location
     - URL
   - If form is empty:
     - Click "Capture Job" button (if visible)
     - Or check console for selector errors

4. **Save Job**:
   - Click "💾 Save Application" button
   - Should see: `✅ Application saved successfully!`
   - Check console for any API errors

5. **Verify in Dashboard**:
   - Go to: `http://localhost:3002/dashboard` (or your frontend URL)
   - Click "Applications" in nav bar
   - Should see your saved job in the list
   - If not visible:
     - Refresh the page
     - Check browser console for API errors
     - Verify backend is running

### 📥 Step 4: Test Bulk Import (LinkedIn Applied Jobs)

1. **Navigate to LinkedIn Applied Jobs**:
   ```
   https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED
   ```
   - Must be on the "Applied" tab (not Saved)
   - Scroll down to load all jobs

2. **Open Extension Popup**:
   - Click extension icon
   - Scroll down to "📋 Bulk Import" section
   - Click "📥 Capture My Applied Jobs" button

3. **Watch the Process**:
   - See notifications:
     - `🔄 Scanning and loading ALL jobs...`
     - `📜 Scrolling to load all jobs...`
     - `🔍 Extracting job data...`
     - `📤 Sending X jobs to backend...`
     - `✅ Successfully imported X jobs!`

4. **Check Console (F12)**:
   - Should see: `✓ [1/X] [Job Title] at [Company]` for each job
   - If you see: `⚠️ Card X missing position data`:
     - LinkedIn's DOM might have changed
     - Check console for debug output showing what was found
   - If you see: `❌ No job cards found`:
     - Make sure you're on Applied tab (not Saved)
     - Try scrolling down more
     - Refresh the page

5. **Verify in Dashboard**:
   - Go to dashboard: `http://localhost:3002/dashboard`
   - Should see all imported jobs
   - Check "Total Applications" metric
   - Check "Daily Application Counts" section

### ⏱️ Step 5: Test Automatic Time Tracking

1. **Navigate to Any Job Detail Page**:
   - Extension automatically starts tracking when you visit a job page
   - Should see notification: `⏱️ Tracking application time...`

2. **Apply for the Job**:
   - Fill out application form
   - Click "Apply" or "Submit" button
   
3. **Application Success Detection**:
   - After submitting, extension detects success
   - Should see: `✅ Application submitted! Time: X min`
   - Job automatically saved to dashboard
   
4. **Verify Time Tracking**:
   - Go to dashboard
   - Check "Total Time Investment" card
   - Should show time spent
   - Check individual job in Applications list

---

## 🔍 Troubleshooting

### Problem: Extension popup shows "Not authenticated"

**Solutions**:
1. Make sure you're logged into the frontend dashboard
2. Click "🔄 Sync Token" button in popup
3. Open frontend tab (`localhost:3002`), then try syncing again
4. Check browser console for errors
5. Verify token exists: `localStorage.getItem('token')` in frontend console

### Problem: Jobs not showing in dashboard

**Check**:
1. Backend is running: `http://localhost:3001/health`
2. Browser console (F12) shows API errors?
3. Token is valid (not expired)
4. Network tab shows successful API calls?
5. Applications page: `http://localhost:3002/dashboard/applications`

### Problem: "Failed to fetch" error

**Check**:
1. Backend running on port 3001
2. CORS is configured correctly
3. Frontend URL matches allowed origins
4. No firewall blocking localhost

### Problem: LinkedIn scraping fails

**Check**:
1. You're on correct page: `/my-items/saved-jobs/?cardType=APPLIED`
2. Jobs are visible on page (scroll to load)
3. Browser console shows debug output
4. Extension reloaded after code changes
5. LinkedIn hasn't changed their DOM structure (check console for selector errors)

### Problem: Auto-tracking not working

**Check**:
1. You're on a job detail page (not listing page)
2. Extension content script is loaded (check console)
3. No errors in browser console
4. Apply button is clicked
5. Success page/message appears after applying

---

## 📊 Expected Results

After successful testing, you should see:

1. **Dashboard**:
   - Total applications count
   - Weekly/monthly statistics
   - Daily application counts
   - Total time spent (if auto-tracking used)
   - Charts showing trends

2. **Applications Page**:
   - List of all saved jobs
   - Filters (status, date range, source)
   - Search functionality
   - Job details (company, position, location, etc.)

3. **Extension Popup**:
   - Shows captured job details when on job page
   - Token status: "✅ Authenticated"
   - Success messages when saving

---

## 🐛 Debug Commands

Open browser console (F12) and try:

```javascript
// Check token in frontend
localStorage.getItem('token')

// Check token in extension storage
chrome.storage.local.get(['token'], (result) => console.log(result))

// Test API connection
fetch('http://localhost:3001/api/applications', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
}).then(r => r.json()).then(console.log)

// Check captured jobs in extension
chrome.storage.local.get(['capturedJobs'], (result) => console.log(result))
```

---

## ✅ Success Checklist

- [ ] Backend running and healthy
- [ ] Frontend running and accessible
- [ ] User logged in (token exists)
- [ ] Extension token synced
- [ ] Single job capture works
- [ ] Bulk import works (LinkedIn)
- [ ] Jobs appear in dashboard
- [ ] Time tracking works (auto-detect)
- [ ] No console errors
- [ ] All metrics displaying correctly

---

If you encounter any issues not covered here, check:
1. Browser console (F12) for errors
2. Backend terminal for server errors
3. Network tab for failed API requests
4. Extension background page console (`chrome://extensions` → "Service worker" → Console)

