export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false });
  }

  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false });
    }

    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

    const response = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({
        query: `
          mutation {
            customerCreate(input: {
              email: "${email}",
              emailMarketingConsent: {
                marketingState: SUBSCRIBED,
                marketingOptInLevel: SINGLE_OPT_IN
              }
            }) {
              customer { id }
              userErrors { message }
            }
          }
        `
      })
    });

    const data = await response.json();

    return res.status(200).json({ success: true });

  } catch (e) {
    return res.status(500).json({ success: false });
  }
}
