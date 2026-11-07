"""Import official GTFS archives into static, per-line navigation files.

Usage: python3 scripts/import-transit.py /tmp/transit/sptrans.zip /tmp/transit/artesp.zip
Re-run with freshly downloaded official archives to update the published catalog.
"""
import csv
import io
import json
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

OUT = Path('public/transit')
OUT.mkdir(parents=True, exist_ok=True)
catalog = []
today = datetime.now(timezone.utc).date().isoformat()

for provider, path, source in [
    ('sptrans', sys.argv[1], 'https://www.sptrans.com.br/desenvolvedores'),
    ('artesp', sys.argv[2], 'https://dadosabertos.artesp.sp.gov.br/group/onibus'),
]:
    z = zipfile.ZipFile(path)
    def rows(name):
        return csv.DictReader(io.TextIOWrapper(z.open(name), encoding='utf-8-sig'))
    routes = {r['route_id']: r for r in rows('routes.txt') if r['route_type'] == '3' and (
        provider == 'sptrans' or 'GUARULHOS' in r['route_long_name'] or 'SAO PAULO (' in r['route_long_name'])}
    trips = defaultdict(list)
    seen = set()
    selected = {}
    for t in rows('trips.txt'):
        key = (t['route_id'], t['direction_id'], t['shape_id'])
        if t['route_id'] in routes and key not in seen:
            seen.add(key)
            trips[t['route_id']].append(t)
            selected[t['trip_id']] = t
    times = defaultdict(list)
    for s in rows('stop_times.txt'):
        if s['trip_id'] in selected:
            times[s['trip_id']].append(s)
    stops = {s['stop_id']: s for s in rows('stops.txt')}
    shapes = defaultdict(list)
    wanted = {t['shape_id'] for t in selected.values()}
    for p in rows('shapes.txt'):
        if p['shape_id'] in wanted:
            shapes[p['shape_id']].append(p)
    calendar = list(rows('calendar.txt'))
    valid_until = max((c['end_date'] for c in calendar), default='')
    version = today
    if 'feed_info.txt' in z.namelist():
        info = next(rows('feed_info.txt'))
        version = info.get('feed_version', today)
        valid_until = info.get('feed_end_date', valid_until)
    for rid, r in routes.items():
        directions = []
        incomplete = False
        for t in sorted(trips[rid], key=lambda x: (x['direction_id'], x['shape_id'])):
            ordered = sorted(times[t['trip_id']], key=lambda x: int(x['stop_sequence']))
            stop_list = []
            for s in ordered:
                p = stops.get(s['stop_id'])
                if not p:
                    incomplete = True
                    break
                stop_list.append(dict(n=int(s['stop_sequence']), name=p['stop_name'], lat=float(p['stop_lat']), lon=float(p['stop_lon'])))
            shape = sorted(shapes[t['shape_id']], key=lambda p: int(p['shape_pt_sequence']))
            if len(stop_list) < 2 or len(shape) < 2:
                incomplete = True
                continue
            directions.append(dict(label=t['trip_headsign'], kind='ida' if t['direction_id'] == '0' else 'volta', stops=stop_list,
                line=[[float(p['shape_pt_lat']), float(p['shape_pt_lon'])] for p in shape]))
        if incomplete or not directions:
            continue  # Never publish a partly reconstructed itinerary.
        id = provider + '-' + rid
        entry = dict(id=id, number=r['route_short_name'], name=r['route_long_name'], provider=provider,
            area='São Paulo' if provider == 'sptrans' else 'Metropolitana', source=source, importedAt=today, version=version,
            validUntil=valid_until, directionCount=len(directions), hasReturn=any(d['kind']=='volta' for d in directions))
        catalog.append(entry)
        (OUT / (id + '.json')).write_text(json.dumps(dict(title='Linha '+r['route_short_name']+' · '+r['route_long_name'], directions=directions, source=entry), ensure_ascii=False, separators=(',', ':')))
    print(provider, 'imported', len([r for r in catalog if r['provider']==provider]))

Path('src/lib/transit-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')))