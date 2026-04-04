# 🔐 Gmail App Password Setup Guide

## Why You're Seeing This Error

Gmail **does not allow** regular passwords for IMAP access. You **MUST** use an **App Password** instead.

The error message you're seeing means:
- ❌ You tried to use your regular Gmail password
- ✅ You need to generate an App Password first

---

## 📋 Step-by-Step: Create Gmail App Password

### Step 1: Enable 2-Step Verification

1. Go to your [Google Account](https://myaccount.google.com/)
2. Click **Security** (left sidebar)
3. Under "Signing in to Google", find **2-Step Verification**
4. If not enabled, click **Get Started** and follow the prompts
5. You'll need to verify your phone number

### Step 2: Generate App Password

1. Still in **Security** settings
2. Find **2-Step Verification** section
3. Click **App passwords** (at the bottom of the 2-Step Verification section)
4. You may need to sign in again
5. Under "Select app", choose **Mail**
6. Under "Select device", choose **Other (Custom name)**
7. Type: **"UK Job Tracker"** or any name you want
8. Click **Generate**
9. **Copy the 16-character password** (spaces don't matter)

### Step 3: Use App Password in Extension

1. Go to **Cold Emails** page → **Parse Emails**
2. Select **Gmail** as provider
3. Enter your **Gmail address** (e.g., `yourname@gmail.com`)
4. **Paste the 16-character App Password** (not your regular password!)
5. Click **Parse Emails**

---

## ⚠️ Important Notes

- **App Passwords are 16 characters** (with spaces: `xxxx xxxx xxxx xxxx`)
- You can remove spaces when pasting - they don't matter
- **Never share your App Password** - treat it like your regular password
- You can generate multiple App Passwords for different apps
- If you lose an App Password, just generate a new one

---

## 🔗 Quick Links

- [Google Support: App Passwords](https://support.google.com/accounts/answer/185833)
- [Google Account Security](https://myaccount.google.com/security)
- [2-Step Verification Setup](https://myaccount.google.com/signinoptions/two-step-verification)

---

## ❓ Troubleshooting

**"Cannot generate App Password"**
- Make sure 2-Step Verification is enabled first
- Try refreshing the App Passwords page

**"Still getting error after using App Password"**
- Make sure you copied the entire 16-character password
- Try generating a new App Password
- Check that you're using the correct Gmail address

**"Don't see App Passwords option"**
- You must have 2-Step Verification enabled
- Use a Google Account (not a Google Workspace account - those use different settings)

---

## ✅ Success!

Once you use an App Password, you should see:
- ✅ Connection successful
- ✅ Emails being parsed
- ✅ Job details extracted automatically

---

## 🔄 For Outlook Users

Outlook users can use their regular password OR an app-specific password if 2FA is enabled. The process is similar - check Outlook security settings.

