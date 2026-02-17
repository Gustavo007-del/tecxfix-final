# TECHFIX Play Store Assets

This directory contains all required assets for Google Play Store submission.

## 📁 Directory Structure

```
store-listing/
├── app-description.txt      # App description for Play Store listing
├── privacy-policy.txt       # Privacy policy summary
├── privacy-policy.html      # Full privacy policy (from backend)
├── terms-of-service.html   # Complete terms of service
├── user-agreement.html      # User agreement document
├── screenshots/             # Add app screenshots here
│   ├── phone-1.png
│   ├── phone-2.png
│   └── phone-3.png
├── feature-graphic.png      # 1024x500px promotional image
└── icon.png                 # 512x512px app icon
```

## 📋 Required Assets (Still Needed)

### Screenshots (Minimum 2, Recommended 8)
- **Format**: PNG or JPEG
- **Size**: 1080x1920px (phone)
- **Content**: Show key app features
  - Login screen
  - Attendance tracking
  - Location dashboard
  - Courier management
  - Admin dashboard
  - Profile settings

### Feature Graphic
- **Format**: PNG or JPEG
- **Size**: 1024x500px
- **Content**: Promotional image with app branding

### High-Resolution Icon
- **Format**: PNG (no transparency)
- **Size**: 512x512px
- **Content**: App icon for Play Store listing

## 📄 Legal Documents Status

✅ **Privacy Policy** - Complete HTML and text versions
✅ **Terms of Service** - Comprehensive terms document
✅ **User Agreement** - Detailed user responsibilities
✅ **App Description** - Play Store optimized description

## 🔗 Integration Notes

### Backend URLs
- Privacy Policy: `/api/privacy-policy/`
- Terms of Service: Needs to be added to backend
- User Agreement: Needs to be added to backend

### App Integration
Add these links to your app:
```javascript
// In settings or profile screen
const links = {
  privacyPolicy: 'https://your-domain.com/api/privacy-policy/',
  termsOfService: 'https://your-domain.com/api/terms-of-service/',
  userAgreement: 'https://your-domain.com/api/user-agreement/'
};
```

## 🚀 Play Store Submission Checklist

### ✅ Completed
- [x] App description
- [x] Privacy policy
- [x] Terms of service
- [x] User agreement
- [x] Directory structure

### ⏳ Pending
- [ ] App screenshots (2-8 images)
- [ ] Feature graphic (1024x500px)
- [ ] High-resolution icon (512x512px)
- [ ] Backend URL configuration
- [ ] In-app links to legal documents

## 📱 Screenshot Guidelines

1. **Login Screen** - Show authentication options
2. **Dashboard** - Display main navigation and features
3. **Attendance** - Show check-in/check-out with location
4. **Location Tracking** - Display map and location features
5. **Courier Management** - Show courier creation/tracking
6. **Admin Panel** - Display administrative features
7. **Profile/Settings** - Show user management options
8. **Notifications** - Display important alerts

## 🔐 Security Notes

- All legal documents are properly formatted
- Privacy policy complies with location tracking requirements
- Terms include necessary disclaimers and limitations
- User agreement covers all app functionality
- Documents include contact information and dates

## 📞 Support Contact

For any questions about these assets or Play Store submission:
- **Email**: shijilkt27@gmail.com
- **Phone**: 9061444017
- **Address**: ASA Lab's, vengeri, kozhikode, kerala
