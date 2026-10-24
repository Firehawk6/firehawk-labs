// Legacy and unlocated visits remain coarse country markers, never invented regions.
export function visitorMarkers(data, countries) {
  const markers = [], located = new Map();
  for (const item of (Array.isArray(data.locations) ? data.locations : []).slice(0, 2000)) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon) || Math.abs(item.lat) > 90 || Math.abs(item.lon) > 180 || !Number.isSafeInteger(item.count) || item.count < 1) continue;
    markers.push({lat:item.lat, lon:item.lon, count:item.count, regional:true});
    located.set(item.code, (located.get(item.code) || 0) + item.count);
  }
  for (const item of data.countries) {
    const country = countries[item.code], count = item.count - (located.get(item.code) || 0);
    if (country && count > 0) markers.push({lat:country.lat, lon:country.lon, count, regional:false});
  }
  return markers;
}
