# ARC Raiders Data API

A simple REST API to get ARC Raiders game data. Need info about items, weapons, hideout modules, quests, or maps? Just make a request and get instant JSON data.

**Live API**: `https://arcdata.mahcks.com`

## Features

- **Fast & Global**: Uses Cloudflare's global network - fast responses no matter where you are
- **Just JSON**: Returns the raw data directly, no extra processing
- **Smart Caching**: 1-hour cache with stale-while-revalidate for always-fast responses
- **Secure**: HTTPS only, with standard security headers
- **CORS Enabled**: Works from browsers, no cross-origin issues
- **Auto-Updated**: Automatically finds new data files as they're added

## API Endpoints

### Base URL
```
https://arcdata.mahcks.com
```

### Complete Datasets (Single File)

These endpoints give you everything in one response:

| Endpoint | What you get |
|----------|-------------|
| `GET /v1/bots` | All ARC/bot info |
| `GET /v1/maps` | All map data |
| `GET /v1/projects` | All project info |
| `GET /v1/skill-nodes` | All skill tree nodes |
| `GET /v1/trades` | All trade/vendor info |

### Collections (Multiple Files)

These endpoints let you list everything or get a specific item:

#### Items
```bash
GET /v1/items                  # List all item IDs (490 items)
GET /v1/items?full=true        # Get ALL items with full data (1 request!)
GET /v1/items/{item_id}        # Get a specific item
```

**Examples:**
```bash
# Get just the list of IDs
curl https://arcdata.mahcks.com/v1/items

# Get all items with complete data in one request
curl https://arcdata.mahcks.com/v1/items?full=true

# Get a specific item
curl https://arcdata.mahcks.com/v1/items/anvil_i
```

#### Hideout Modules
```bash
GET /v1/hideout                  # List all hideout module IDs
GET /v1/hideout?full=true        # Get ALL modules with full data
GET /v1/hideout/{module_id}      # Get a specific module
```

**Example:**
```bash
curl https://arcdata.mahcks.com/v1/hideout?full=true
```

#### Quests
```bash
GET /v1/quests                   # List all quest IDs
GET /v1/quests?full=true         # Get ALL quests with full data
GET /v1/quests/{quest_id}        # Get a specific quest
```

**Example:**
```bash
curl https://arcdata.mahcks.com/v1/quests?full=true
```

#### Map Events
```bash
GET /v1/map-events                # List all map event IDs
GET /v1/map-events?full=true      # Get ALL events with full data
GET /v1/map-events/{event_id}     # Get a specific event
```

### API Information
```bash
GET /v1    # Returns API info and all available endpoints
```

## Response Format

### List Endpoints
```json
{
  "type": "items",
  "count": 490,
  "items": [
    {
      "id": "anvil_i",
      "url": "/v1/items/anvil_i"
    },
    ...
  ]
}
```

### Individual Item Endpoints
Returns the complete JSON data for whatever you requested.

### Error Responses
```json
{
  "error": "Item not found: invalid_id"
}
```

## Performance Tips

### Use `?full=true` to avoid multiple requests

Instead of making hundreds of requests:
```javascript
// ❌ BAD - Makes 491 requests (1 for list + 490 for each item)
const list = await fetch('/v1/items').then(r => r.json());
const items = await Promise.all(
  list.items.map(item => fetch(item.url).then(r => r.json()))
);
```

Use the `?full=true` parameter:
```javascript
// ✅ GOOD - Makes 1 request total
const { items } = await fetch('/v1/items?full=true').then(r => r.json());
```

**Performance difference:**
- Without `?full=true`: **491 requests** (~5-10 seconds)
- With `?full=true`: **1 request** (~500ms)

## How Caching Works

The API uses smart caching with stale-while-revalidate:

1. **First Request**: Gets data from GitHub and caches it
2. **Next Hour**: Served from cache (instant)
3. **After 1 Hour**: Serves cached data immediately while fetching fresh data in the background
4. **Stale Tolerance**: Will serve cached data up to 24 hours old if GitHub is slow/unavailable

**What this means:**
- 🚀 Always instant responses (no waiting for GitHub)
- 🔄 Fresh data (usually within 1 hour)
- 💪 Resilient (works even if GitHub is down)
- 💰 Efficient (minimal GitHub API usage)

**Cache Duration:**
- Fresh: 1 hour
- Stale-while-revalidate: 24 hours
- The `?full=true` response is also cached separately

## Security

The API is secure by default:

- **HTTPS Only**: All requests are automatically redirected to HTTPS
- **Security Headers**: Standard browser protections enabled
- **No Clickjacking**: Can't be embedded in malicious iframes
- **Safe MIME Types**: Browser won't misinterpret file types

## CORS

Works from browsers without issues:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## Rate Limits

No strict rate limits on the API itself. Keep in mind:

- Cloudflare Workers free tier: 100,000 requests/day
- GitHub API: 60 requests/hour - but caching means you rarely hit this

## Usage Examples

### JavaScript/TypeScript
```javascript
// Fetch all items
const response = await fetch('https://arcdata.mahcks.com/v1/items');
const { items, count } = await response.json();

// Get specific item
const item = await fetch('https://arcdata.mahcks.com/v1/items/anvil_i');
const itemData = await item.json();
```

### Python
```python
import requests

# List all quests
response = requests.get('https://arcdata.mahcks.com/v1/quests')
data = response.json()
print(f"Found {data['count']} quests")

# Get specific quest
quest = requests.get('https://arcdata.mahcks.com/v1/quests/power_out')
print(quest.json()['name']['en'])
```

### cURL
```bash
# Get all bots
curl https://arcdata.mahcks.com/v1/bots

# Get specific hideout module
curl https://arcdata.mahcks.com/v1/hideout/weapon_bench

# Get API info
curl https://arcdata.mahcks.com/v1
```

## How It Works

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Your App  │─────>│ Cloudflare Worker│─────>│   GitHub    │
│  (Browser)  │<─────│  (Cache & Proxy) │<─────│ (Data Files)│
└─────────────┘      └──────────────────┘      └─────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   Cached Data   │
                     │ (Fresh 5 mins)  │
                     └─────────────────┘
```

**Simple flow:**
1. You make a request
2. Cloudflare checks if it has cached data
3. If yes → returns it instantly
4. If no/expired → fetches from GitHub, caches it, returns it
5. Next requests use the cache

## Data Source

This API gets its data from the official ARC Raiders community repository:

**Source**: [RaidTheory/arcraiders-data](https://github.com/RaidTheory/arcraiders-data)

The data is from ARC Raiders Tech Test 2 and maintained by the community.

## Attribution

If you use this API, please credit:

- **Data Source**: [https://github.com/RaidTheory/arcraiders-data](https://github.com/RaidTheory/arcraiders-data)
- **ARC Tracker**: [https://arctracker.io](https://arctracker.io)
- **This API**: [https://github.com/mahcks/arcraiders-data-api](https://github.com/mahcks/arcraiders-data-api)

## Community

Join our Discord to chat about ARC Raiders and connect with other developers:

[![Discord](https://img.shields.io/discord/1371502069374255265?color=7289DA&label=Discord&logo=discord&logoColor=white)](https://discord.gg/pAtQ4Aw8em)

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

### Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: JavaScript
- **Network**: Cloudflare's global network
- **Data Source**: GitHub

### Project Structure

```
arcraiders-data-api/
├── src/
│   └── index.js          # Main API code
├── test/
│   └── index.spec.js     # Tests
├── wrangler.jsonc        # Cloudflare config
├── package.json
└── README.md
```

## License

MIT License - See LICENSE file for details

## Contact

Questions or issues?

- **Issues**: [GitHub Issues](https://github.com/mahcks/arcraiders-data-api/issues)
- **Discord**: [Join our community](https://discord.gg/pAtQ4Aw8em)

---

**Note**: This data is from ARC Raiders Tech Test 2 and may change as the game evolves.

Built with ❤️ by the ARC Raiders community
