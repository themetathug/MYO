# 📥 LinkedIn Job Import Guide

## **Super Simple - 3 Steps!**

### **Step 1: Click the Blue Button**
On your dashboard, click the **"📥 Import from LinkedIn"** button (top right)

### **Step 2: On LinkedIn Page**
You'll be taken to LinkedIn's "My Jobs/Applied" page
- Click the **UK Jobs Insider Chrome extension icon** (top right of browser)
- Click **"📥 Capture My Applied Jobs"** button

### **Step 3: Done!**
All your LinkedIn jobs will automatically sync to your dashboard! 🎉

---

## **What Gets Imported?**

✅ Company name  
✅ Job position/title  
✅ Location  
✅ Date applied  
✅ Status (automatically set to "APPLIED")  

---

## **Where to See Imported Jobs?**

1. **Dashboard** - Stats and analytics
2. **Applications Page** - Full list with filters/search
   - Click "Applications" in the top nav bar

---

## **How Often Can I Import?**

- Import as many times as you want!
- The system **prevents duplicates** automatically
- Recommended: Import once per week to keep your tracker updated

---

## **Troubleshooting**

### **"No jobs found" error?**
- Make sure you're on the **"Applied"** tab on LinkedIn
- Scroll down to load more jobs
- Try refreshing the page

### **"Not authenticated" error?**
1. Login to your dashboard at http://localhost:3000
2. Open the extension popup
3. Click "🔄 Sync Token" button
4. Try importing again

### **Jobs not showing on dashboard?**
- Refresh your dashboard page
- Check the "Applications" page in the nav bar
- Make sure the date range filter includes when you applied

---

## **Technical Details** (for developers)

- **Content Script**: `extension/content.js` → `captureLinkedInMyJobs()` function
- **Popup Button**: `extension/popup.html` → "capture-my-jobs-btn"
- **Backend API**: `POST /api/applications` (bulk insert)
- **Frontend**: Dashboard auto-fetches from backend

**LinkedIn Selectors Used:**
```javascript
jobCards: '[data-test-job-card], .jobs-search-results__list-item'
company: '.job-card-container__primary-description, .job-card-list__company-name'
position: '.job-card-list__title, .job-card-container__link'
location: '.job-card-container__metadata-item'
```

---

**Need Help?** Check console logs (F12) for detailed error messages

