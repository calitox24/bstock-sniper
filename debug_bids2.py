import re, json
with open('debug_bids_page.html', encoding='utf-8', errors='replace') as f:
    html = f.read()
m = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
data = json.loads(m.group(1))
queries = data['props']['pageProps']['dehydratedState']['queries']
print(f"Total queries: {len(queries)}")
for i, q in enumerate(queries):
    key = q.get('queryKey', '')
    state = q.get('state', {})
    qdata = state.get('data', {})
    if isinstance(qdata, dict):
        claves = list(qdata.keys())[:5]
    elif isinstance(qdata, list):
        claves = f"list[{len(qdata)}]"
    else:
        claves = str(qdata)[:60]
    print(f"  [{i}] key={str(key)[:80]}  data={claves}")
