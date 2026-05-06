# TradeMeter Mobile

React Native mobile app for TradeMeter, built with Expo.

## Start Development

```powershell
npm install
npm start
```

Scan the Expo QR code with Expo Go on Android.

## Backend

The app expects a JSON login endpoint at:

```text
https://trademeter-app-3e1889251956.herokuapp.com/api/login.php
```

Expected response:

```json
{
  "status": "success",
  "role": "admin",
  "token": "example-token",
  "user": {
    "name": "User Name"
  }
}
```
