import re, json
with open('debug_bids_page.html', encoding='utf-8', errors='replace') as f:
    html = f.read()
m = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
if m:
    data = json.loads(m.group(1))
    print('Encontrado! Claves top:', list(data.keys()))
    pp = data.get('props', {}).get('pageProps', {})
    print('pageProps claves:', list(pp.keys()))
    # Ver las claves anidadas
    for k, v in pp.items():
        t = type(v).__name__
        if isinstance(v, list):
            print(f"  {k}: list[{len(v)}]")
        elif isinstance(v, dict):
            print(f"  {k}: dict{list(v.keys())[:5]}")
        else:
            print(f"  {k}: {t} = {str(v)[:80]}")
else:
    print('No encontrado con regex flexible')
    # Buscar manualmente
    idx = html.find('__NEXT_DATA__')
    print(f'  Posicion en HTML: {idx}')
    print(f'  Contexto: {html[idx-20:idx+200]}')
