# Calendly Integration Fix

## Issues Fixed

### 1. Content Security Policy (CSP) Error
**Problem:** Console error: `Framing 'https://calendly.com/' violates the following Content Security Policy directive: "frame-src 'self'"`

**Solution:** Updated `vercel.json` to allow Calendly in CSP headers:
- Added `https://calendly.com` to `frame-src`
- Added `https://assets.calendly.com` to `script-src` and `style-src`
- Added `https://calendly.com` to `connect-src`
- Also added `https://checkout.stripe.com` to `frame-src` for Stripe payments

### 2. Missing Calendly Booking After Payment
**Problem:** After successful payment, users were not shown the Calendly booking widget

**Solution:** Updated `PaymentSuccess.js` to:
- Import `InlineWidget` from `react-calendly`
- Show Calendly booking widget after 2 seconds
- Removed auto-redirect countdown (let users book first)
- Added Calendar icon and clear heading

## Changes Made

### Files Modified:
1. **vercel.json** - Updated CSP headers
2. **frontend/src/pages/PaymentSuccess.js** - Added Calendly widget

## How It Works Now

### Payment Success Flow:
1. User completes payment on Stripe
2. Redirected to `/payment-success?session_id=xxx`
3. Success message displays immediately
4. After 2 seconds, Calendly booking widget appears
5. User can schedule their consultation
6. User can then navigate home or view services

## Testing

To test the fix:
1. Complete a test payment for Claim Readiness Review
2. You should be redirected to the success page
3. After 2 seconds, Calendly widget should appear
4. No CSP errors in console
5. You should be able to book a meeting

## Calendly Configuration

The widget uses: `https://calendly.com/militarydisabilitynexus/30min`

To change the Calendly link, edit `PaymentSuccess.js` line with `InlineWidget url=`

## Notes

- CSP changes require redeployment to Vercel to take effect
- Calendly widget is responsive and works on mobile
- Users are no longer auto-redirected, giving them time to book
