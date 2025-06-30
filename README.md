# Central Log Server for System Monitor Agents

This is a full-featured Node.js/Express server with MongoDB for receiving, storing, and querying logs from system-monitor agents.

## Features
- Receives logs via HTTP POST (`/api/logs`)
- Stores logs in MongoDB (flexible schema)
- Query logs via HTTP GET (`/api/logs`)
- Health check endpoint (`/`)
- CORS enabled for cross-origin requests
- Uses morgan for request logging

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start MongoDB:**
   - Make sure MongoDB is running locally (default: `mongodb://localhost:27017`)
   - You can edit `.env.example` and rename to `.env` to change settings
3. **Start the server:**
   ```sh
   npm start
   ```
4. **Endpoints:**
   - `POST /api/logs` — receive a log (JSON body)
   - `GET /api/logs?limit=100&user=alice&type=active-window&hostname=PC001` — query logs
   - `GET /` — health check

## Example Agent Configuration
Set your agent's `CENTRAL_SERVER_URL` to:
```
http://<server-ip>:3000/api/logs
```

## Security
- For production, add authentication and HTTPS.

---
