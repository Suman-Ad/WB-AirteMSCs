// Search text is indexed once per changed Firestore document, rather than per keystroke.
export function assetRecord(document) {
  const values = document.data();
  return { id: document.id, values, searchText: Object.values(values).map(String).join('\n').toLowerCase() };
}

export function assetCatalogue(records) {
  const regions = new Set(), circles = new Map(), sites = new Map();
  for (const {values:asset} of records) {
    if (asset.Region) regions.add(asset.Region);
    if (!circles.has(asset.Region)) circles.set(asset.Region,new Set());
    if (asset.Circle) circles.get(asset.Region).add(asset.Circle);
    if (!sites.has(asset.Region)) sites.set(asset.Region,new Map());
    const byCircle = sites.get(asset.Region);
    if (!byCircle.has(asset.Circle)) byCircle.set(asset.Circle,new Set());
    if (asset.SiteName) byCircle.get(asset.Circle).add(asset.SiteName);
  }
  return {regions:[...regions],circles,sites};
}

export function filterAssetRecords(records, region, circle, site, search) {
  const term = search.toLowerCase();
  return records.filter(({values:asset,searchText}) =>
    (!region || asset.Region === region) && (!circle || asset.Circle === circle) &&
    (!site || asset.SiteName === site) && (!term || searchText.includes(term)));
}

export function assetSummary(records) {
  const sites = new Set(), categories = Object.create(null);
  for (const {values:asset} of records) {
    sites.add(asset.SiteName);
    const category = asset.EquipmentCategory || 'Unknown';
    categories[category] = (categories[category] || 0)+1;
  }
  return {siteCount:sites.size,categoryCounts:categories};
}
