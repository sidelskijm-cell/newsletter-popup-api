function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://whitehack.store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function getAccessToken(shop, clientId, clientSecret) {
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    })
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to get access token');
  }

  return tokenData.access_token;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!shop || !clientId || !clientSecret) {
      return res.status(500).json({ success: false, error: 'Missing environment variables' });
    }

    const accessToken = await getAccessToken(shop, clientId, clientSecret);

    const response = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        query: `
          mutation customerCreate($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer {
                id
                email
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            email,
            emailMarketingConsent: {
              marketingState: 'SUBSCRIBED',
              marketingOptInLevel: 'SINGLE_OPT_IN'
            }
          }
        }
      })
    });

    const data = await response.json();
    const userErrors = data?.data?.customerCreate?.userErrors || [];

    if (userErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: userErrors[0].message
      });
    }

    return res.status(200).json({
      success: true,
      customer: data?.data?.customerCreate?.customer || null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
