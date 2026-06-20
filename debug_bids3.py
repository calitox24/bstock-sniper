import re, json
with open('debug_bids_page.html', encoding='utf-8', errors='replace') as f:
    html = f.read()
m = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
data = json.loads(m.group(1))
queries = data['props']['pageProps']['dehydratedState']['queries']
bids_query = next(q for q in queries if 'uniqueUserBids' in str(q.get('queryKey','')))
bids_data = bids_query['state']['data']
print(f"total: {bids_data['total']}, offset: {bids_data['offset']}, limit: {bids_data['limit']}")
print(f"statusCount: {bids_data['statusCount']}")
print(f"bids en esta pagina: {len(bids_data['bids'])}")
if bids_data['bids']:
    print("\nPrimera puja:")
    print(json.dumps(bids_data['bids'][0], indent=2))
