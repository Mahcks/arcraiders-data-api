/**
 * ArcRaiders Data API
 * Proxies requests to GitHub raw content with caching
 */

const GITHUB_BASE = 'https://raw.githubusercontent.com/RaidTheory/arcraiders-data/main';
const CACHE_TTL = 300; // 5 minutes

// Define valid data types and their paths
// For directory-based collections (multiple JSON files in folders)
const COLLECTION_TYPES = {
	items: 'items',
	hideout: 'hideout',
	quests: 'quests',
	'map-events': 'map-events',
};

// For single-file data types (root-level JSON files)
const SINGLE_FILE_TYPES = {
	bots: 'bots.json',
	maps: 'maps.json',
	projects: 'projects.json',
	skillNodes: 'skillNodes.json',
	'skill-nodes': 'skillNodes.json', // Alias with hyphen
	trades: 'trades.json',
};

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Enforce HTTPS - redirect HTTP to HTTPS
		if (url.protocol === 'http:') {
			const httpsUrl = url.toString().replace('http://', 'https://');
			return Response.redirect(httpsUrl, 301);
		}

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return handleCors();
		}

		// Route matching
		try {
			// GET /v1/{type} - get single-file data or list collection items
			const listMatch = path.match(/^\/v1\/([a-z-]+)\/?$/);
			if (listMatch) {
				const type = listMatch[1];

				// Check if it's a single-file type
				if (SINGLE_FILE_TYPES[type]) {
					return await handleSingleFile(type, env, ctx);
				}

				// Otherwise try as a collection list
				if (COLLECTION_TYPES[type]) {
					return await handleList(type, env, ctx);
				}

				return jsonResponse({ error: `Unknown data type: ${type}` }, 404);
			}

			// GET /v1/{type}/{id} - get single item from a collection
			const itemMatch = path.match(/^\/v1\/([a-z-]+)\/([a-z0-9_-]+)\/?$/);
			if (itemMatch) {
				return await handleGetItem(itemMatch[1], itemMatch[2], env, ctx);
			}

			// GET /v1 or / - API info
			if (path === '/v1' || path === '/v1/' || path === '/') {
				return jsonResponse({
					name: 'ArcRaiders Data API',
					version: '1.0.0',
					endpoints: {
						// Single-file endpoints
						bots: '/v1/bots',
						maps: '/v1/maps',
						projects: '/v1/projects',
						skillNodes: '/v1/skill-nodes',
						trades: '/v1/trades',
						// Collection endpoints
						items: '/v1/items',
						item: '/v1/items/{item_id}',
						hideout: '/v1/hideout',
						hideoutModule: '/v1/hideout/{module_id}',
						quests: '/v1/quests',
						quest: '/v1/quests/{quest_id}',
						mapEvents: '/v1/map-events',
						mapEvent: '/v1/map-events/{event_id}',
					},
					source: 'https://github.com/RaidTheory/arcraiders-data',
				});
			}

			return jsonResponse({ error: 'Not Found' }, 404);
		} catch (error) {
			console.error('Error:', error);
			return jsonResponse({ error: 'Internal Server Error' }, 500);
		}
	},
};

/**
 * Fetch a single-file data type (e.g., bots.json, maps.json)
 */
async function handleSingleFile(type, env, ctx) {
	const filename = SINGLE_FILE_TYPES[type];
	const githubUrl = `${GITHUB_BASE}/${filename}`;

	// Check cache first
	const cache = caches.default;
	const cacheKey = new Request(githubUrl);
	let response = await cache.match(cacheKey);

	if (!response) {
		// Fetch from GitHub
		const githubResponse = await fetch(githubUrl, {
			headers: {
				'User-Agent': 'ArcRaiders-API/1.0',
			},
		});

		if (!githubResponse.ok) {
			if (githubResponse.status === 404) {
				return jsonResponse({ error: `Data not found: ${type}` }, 404);
			}
			return jsonResponse({ error: 'Failed to fetch data' }, 502);
		}

		// Pass through the raw JSON response from GitHub (already formatted)
		response = new Response(githubResponse.body, {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': `public, max-age=${CACHE_TTL}`,
			},
		});

		// Store in cache (non-blocking)
		ctx.waitUntil(cache.put(cacheKey, response.clone()));
	}

	return addCorsHeaders(response);
}

/**
 * Fetch a single item by type and ID
 */
async function handleGetItem(type, id, env, ctx) {
	if (!COLLECTION_TYPES[type]) {
		return jsonResponse({ error: `Unknown collection type: ${type}` }, 404);
	}

	const githubUrl = `${GITHUB_BASE}/${COLLECTION_TYPES[type]}/${id}.json`;

	// Check cache first
	const cache = caches.default;
	const cacheKey = new Request(githubUrl);
	let response = await cache.match(cacheKey);

	if (!response) {
		// Fetch from GitHub
		const githubResponse = await fetch(githubUrl, {
			headers: {
				'User-Agent': 'ArcRaiders-API/1.0',
			},
		});

		if (!githubResponse.ok) {
			if (githubResponse.status === 404) {
				return jsonResponse({ error: `${type.slice(0, -1)} not found: ${id}` }, 404);
			}
			return jsonResponse({ error: 'Failed to fetch data' }, 502);
		}

		// Pass through the raw JSON response from GitHub (already formatted)
		response = new Response(githubResponse.body, {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': `public, max-age=${CACHE_TTL}`,
			},
		});

		// Store in cache (non-blocking)
		ctx.waitUntil(cache.put(cacheKey, response.clone()));
	}

	return addCorsHeaders(response);
}

/**
 * List all items of a type
 * Uses GitHub API to dynamically list directory contents
 */
async function handleList(type, env, ctx) {
	if (!COLLECTION_TYPES[type]) {
		return jsonResponse({ error: `Unknown collection type: ${type}` }, 404);
	}

	const dirPath = COLLECTION_TYPES[type];
	const githubApiUrl = `https://api.github.com/repos/RaidTheory/arcraiders-data/contents/${dirPath}`;

	// Check cache first
	const cache = caches.default;
	const cacheKey = new Request(githubApiUrl);
	let response = await cache.match(cacheKey);

	if (!response) {
		// Fetch from GitHub API
		const githubResponse = await fetch(githubApiUrl, {
			headers: {
				'User-Agent': 'ArcRaiders-API/1.0',
				Accept: 'application/vnd.github.v3+json',
			},
		});

		if (!githubResponse.ok) {
			return jsonResponse({ error: `Failed to list ${type}` }, 502);
		}

		const files = await githubResponse.json();

		// Filter to only .json files and extract IDs
		const items = files
			.filter((f) => f.type === 'file' && f.name.endsWith('.json') && !f.name.startsWith('_'))
			.map((f) => ({
				id: f.name.replace('.json', ''),
				url: `/v1/${type}/${f.name.replace('.json', '')}`,
			}))
			.sort((a, b) => a.id.localeCompare(b.id));

		const data = {
			type,
			count: items.length,
			items,
		};

		// Create cacheable response
		response = jsonResponse(data);
		response.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);

		// Store in cache (non-blocking)
		ctx.waitUntil(cache.put(cacheKey, response.clone()));
	}

	return addCorsHeaders(response);
}

/**
 * Helper: Create JSON response
 */
function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

/**
 * Helper: Add CORS and security headers to response
 */
function addCorsHeaders(response) {
	const newResponse = new Response(response.body, response);

	// CORS headers
	newResponse.headers.set('Access-Control-Allow-Origin', '*');
	newResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
	newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');

	// Security headers
	newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	newResponse.headers.set('X-Content-Type-Options', 'nosniff');
	newResponse.headers.set('X-Frame-Options', 'DENY');
	newResponse.headers.set('X-XSS-Protection', '1; mode=block');
	newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	return newResponse;
}

/**
 * Helper: Handle CORS preflight
 */
function handleCors() {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Max-Age': '86400',
			'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
		},
	});
}
