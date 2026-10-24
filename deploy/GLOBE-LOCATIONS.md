# Approximate regional globe

In Cloudflare, select firehawk6.com → Rules → Settings → Managed Transforms, and enable **Add visitor location headers**. This supplies CF-IPLatitude and CF-IPLongitude based on the public connection IP. IP Geolocation alone only supplies the country.

From the existing VM checkout:

```sh
npm run build
sudo bash deploy/update-globe.sh
sudo cp -a dist/. /var/www/firehawk-labs/
sudo chown -R www-data:www-data /var/www/firehawk-labs
sudo chmod -R u=rwX,go=rX /var/www/firehawk-labs
```

Existing visitor, sorter and Twitch settings remain intact. The additive locations table starts empty; existing country counts aren't assigned invented coordinates. New counted sessions with valid headers increment both the country and a half-degree regional bucket (roughly 56 km north/south; longitude spacing varies with latitude). Original coordinates, city names and IPs are not stored. There is no browser GPS request. Same-tab refreshes remain deduplicated; a session already counted today does not gain a new regional dot. Use a genuinely new browsing session to check the rollout.

The public API returns the 2,000 most visited regional buckets. Any remaining visits are represented in dimmer country fallback dots, keeping totals consistent. The frontend uses instanced dots to avoid a draw call per marker. Nearby visits share a regional dot; this is deliberately coarse, not a map of individual people. VPN, satellite and mobile egress can be distant from the visitor.

The collector trusts Cloudflare's managed headers through the existing Tunnel. Keep the collector on loopback and origin access restricted; direct origin access would allow clients to forge geographic headers. Invalid/missing headers still count a visit and country, but not a region. Do not enable raw header/IP logging for these endpoints.

Check https://labs.firehawk6.com/api/visitors for a nonempty locations array after a new visit. If empty, confirm the Cloudflare transform and Nginx snippet update; don't reset the database. Build, marker tests and collector tests are automated; real Cloudflare header delivery needs verification after enabling the transform.

Reference: https://developers.cloudflare.com/rules/transform/managed-transforms/reference/#add-visitor-location-headers
