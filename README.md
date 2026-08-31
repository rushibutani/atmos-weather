# Atmos Weather

A production-oriented weather application built with Next.js, TypeScript, React, and Tailwind CSS.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Add a WeatherAPI.com key as `WEATHER_API_KEY`.
3. Run `npm install`, then `npm run dev`.

The browser only talks to internal Next.js API routes. The API key remains server-side.

## Production

1. Rotate any API key that has ever been committed and add the new key to Vercel as
   `WEATHER_API_KEY` for Preview and Production. Never commit the value.
2. Configure a Vercel Firewall rate-limit rule for `/api/weather`. The small in-process
   limiter is only a fallback and is not shared across serverless instances.
3. Run `npm run check` before merging to the production branch.
4. Test a Preview deployment, then merge to `main` to deploy Production.

Location access is opt-in through the browser's geolocation permission. The app does
not attempt to infer a visitor's city from a server IP address.
