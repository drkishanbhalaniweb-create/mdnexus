# Pricing Management System

## Overview
The pricing management system allows admins to update service prices through the admin panel without editing code.

## Features
- ✅ Database-driven pricing
- ✅ Admin UI for price management
- ✅ Real-time price updates
- ✅ Active/Inactive service toggle
- ✅ Rush service fee configuration
- ✅ Fallback to hardcoded prices if database unavailable

## Setup

### 1. Run the Migration
```bash
# Apply the pricing table migration
supabase migration up
```

This creates:
- `service_pricing` table
- RLS policies for public read and admin write
- Default pricing for all services

### 2. Access the Admin Panel
Navigate to: `/admin/pricing`

## How to Change Prices

### Via Admin Panel (Recommended)
1. Log in to admin panel
2. Go to "Pricing" in the sidebar
3. Edit the price fields:
   - **Base Price**: Enter amount in cents (e.g., 22500 for $225)
   - **Rush Fee**: Enter rush service fee in cents
4. Toggle **Active** status to enable/disable services
5. Click **Save** for each service

### Price Conversion Guide
- $100.00 = 10000 cents
- $225.00 = 22500 cents
- $500.00 = 50000 cents
- $1,500.00 = 150000 cents
- $2,000.00 = 200000 cents

## Database Schema

```sql
CREATE TABLE service_pricing (
  id UUID PRIMARY KEY,
  service_type TEXT UNIQUE NOT NULL,
  service_name TEXT NOT NULL,
  base_price INTEGER NOT NULL,  -- Price in cents
  rush_fee INTEGER DEFAULT 0,   -- Rush fee in cents
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Available Services

| Service Type | Default Base Price | Default Rush Fee |
|-------------|-------------------|------------------|
| claim_readiness_review | $225 | $0 |
| aid_attendance | $2,000 | $500 |
| nexus_letter | $1,500 | $500 |
| dbq_completion | $800 | $300 |
| medical_opinion | $1,200 | $400 |
| cp_exam_prep | $500 | $200 |
| claim_1151 | $2,000 | $500 |

## How It Works

### Frontend Flow
1. User visits service page (e.g., Claim Readiness Review)
2. Page fetches pricing from database via `fetchPricing()`
3. Displays current price to user
4. On payment, sends calculated amount to Stripe
5. Stripe processes payment with that amount

### Backend Flow
1. Admin updates price in admin panel
2. Price saved to `service_pricing` table
3. Frontend automatically uses new price on next page load
4. No code deployment needed

## Fallback System
If database is unavailable, the system falls back to hardcoded prices in `frontend/src/lib/payment.js`.

## Files Modified

### New Files
- `supabase/migrations/017_service_pricing.sql` - Database schema
- `frontend/src/pages/admin/Pricing.js` - Admin UI
- `docs/PRICING_MANAGEMENT.md` - This documentation

### Modified Files
- `frontend/src/App.js` - Added pricing route
- `frontend/src/components/admin/AdminLayout.js` - Added pricing nav link
- `frontend/src/lib/payment.js` - Added `fetchPricing()` function

## Security
- Public users can only READ active pricing
- Only authenticated admins can UPDATE pricing
- RLS policies enforce access control

## Notes
- Prices are stored in cents to avoid floating-point issues
- Changes take effect immediately for new purchases
- Existing checkout sessions use the price at time of creation
- Inactive services won't appear in pricing queries
