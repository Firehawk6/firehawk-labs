"""Coarse location and country visit aggregates. Run behind the supplied Nginx configuration."""
import hashlib
import math
import json
import os
import re
import sqlite3
import time
import threading
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError
from datetime import datetime, timedelta, timezone
from pathlib import Path
from flask import Flask, jsonify, request

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 256
DATABASE = os.environ.get('VISITOR_DB', '/var/lib/firehawk-visitors/visitors.sqlite3')
PUBLIC_ORIGIN = os.environ.get('PUBLIC_ORIGIN', '').rstrip('/')


def connect():
    db = sqlite3.connect(DATABASE, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript('''
      CREATE TABLE IF NOT EXISTS sort_runs (day TEXT, run TEXT, PRIMARY KEY(day,run));
      CREATE TABLE IF NOT EXISTS sort_totals (id INTEGER PRIMARY KEY CHECK(id=1), total INTEGER NOT NULL);
      INSERT OR IGNORE INTO sort_totals VALUES(1,0);
      CREATE TABLE IF NOT EXISTS sessions (day TEXT, token TEXT, PRIMARY KEY(day,token));
      CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, visits INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS locations (country TEXT, lat REAL, lon REAL, visits INTEGER NOT NULL, PRIMARY KEY(country,lat,lon));
      CREATE TABLE IF NOT EXISTS countries (code TEXT PRIMARY KEY, visits INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY CHECK(id=1), visits INTEGER NOT NULL, since TEXT NOT NULL);
    ''')
    db.execute('INSERT OR IGNORE INTO totals VALUES(1,0,?)', (datetime.now(timezone.utc).date().isoformat(),))
    db.commit()
    return db


@app.after_request
def private_response(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.get('/api/visitors')
def stats():
    today = datetime.now(timezone.utc).date().isoformat()
    db = connect()
    try:
        total, since = db.execute('SELECT visits,since FROM totals WHERE id=1').fetchone()
        row = db.execute('SELECT visits FROM daily WHERE day=?', (today,)).fetchone()
        countries = [{'code':code,'count':count} for code,count in db.execute('SELECT code,visits FROM countries ORDER BY visits DESC,code')]
        locations = [{'code':code, 'lat':lat, 'lon':lon, 'count':count} for code,lat,lon,count in db.execute('SELECT country,lat,lon,visits FROM locations ORDER BY visits DESC,country,lat,lon LIMIT 2000')]
        return jsonify(total=total, today=row[0] if row else 0, countries=countries, locations=locations, since=since)
    finally:
        db.close()


@app.post('/api/visitors/visit')
def visit():
    # Explicit origin prevents other websites from submitting browser visits.
    if not PUBLIC_ORIGIN or request.headers.get('Origin') != PUBLIC_ORIGIN:
        return jsonify(error='Origin not allowed'), 403
    if request.headers.get('Sec-Fetch-Site') not in (None, 'same-origin'):
        return jsonify(error='Cross-site request'), 403
    if not request.is_json:
        return jsonify(error='JSON required'), 415
    data = request.get_json(silent=True)
    session = data.get('session') if isinstance(data, dict) else None
    if not isinstance(session,str) or not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',session,re.I):
        return jsonify(error='Invalid session'), 400
    # CF-IPCountry must come through Cloudflare Tunnel, never from client JSON.
    country = request.headers.get('CF-IPCountry','').upper()
    if not re.fullmatch('[A-Z]{2}',country) or country in ('XX','T1'):
        country = None
    location = None
    # Trust only headers delivered through the configured Cloudflare Tunnel.
    # Round before persistence; never store IPs or the original coordinates.
    if country:
        try:
            lat = float(request.headers.get('CF-IPLatitude', ''))
            lon = float(request.headers.get('CF-IPLongitude', ''))
            if math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180:
                location = (math.floor(lat * 2 + .5) / 2, (math.floor(lon * 2 + .5) / 2 + 180) % 360 - 180)
        except (ValueError, TypeError):
            pass
    now = datetime.now(timezone.utc).date()
    day = now.isoformat()
    token = hashlib.sha256((day + session).encode()).hexdigest()
    db = connect()
    try:
        with db:
            added = db.execute('INSERT OR IGNORE INTO sessions VALUES(?,?)',(day,token)).rowcount == 1
            if added:
                db.execute('UPDATE totals SET visits=visits+1 WHERE id=1')
                db.execute('INSERT INTO daily VALUES(?,1) ON CONFLICT(day) DO UPDATE SET visits=visits+1',(day,))
                if country:
                    db.execute('INSERT INTO countries VALUES(?,1) ON CONFLICT(code) DO UPDATE SET visits=visits+1',(country,))
                if location is not None:
                    db.execute('INSERT INTO locations VALUES(?,?,?,1) ON CONFLICT(country,lat,lon) DO UPDATE SET visits=visits+1', (country, *location))
            db.execute('DELETE FROM sessions WHERE day < ?',((now-timedelta(days=1)).isoformat(),))
            db.execute('DELETE FROM daily WHERE day < ?',((now-timedelta(days=400)).isoformat(),))
        return jsonify(recorded=added)
    finally:
        db.close()


@app.get('/api/sorts')
def sort_stats():
    db = connect()
    try:
        return jsonify(total=db.execute('SELECT total FROM sort_totals WHERE id=1').fetchone()[0])
    finally:
        db.close()


@app.post('/api/sorts/complete')
def sort_complete():
    # Browser-reported completions, not cryptographic proof of computation.
    if not PUBLIC_ORIGIN or request.headers.get('Origin') != PUBLIC_ORIGIN:
        return jsonify(error='Origin not allowed'), 403
    if request.headers.get('Sec-Fetch-Site') not in (None, 'same-origin'):
        return jsonify(error='Cross-site request'), 403
    if not request.is_json:
        return jsonify(error='JSON required'), 415
    data = request.get_json(silent=True)
    run = data.get('run') if isinstance(data, dict) else None
    day = datetime.now(timezone.utc).date().isoformat()
    if not isinstance(run, str) or not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', run, re.I):
        return jsonify(error='Invalid run'), 400
    if data.get('day') != day:
        return jsonify(error='Completion date must be today in UTC'), 400
    db = connect()
    try:
        with db:
            added = db.execute('INSERT OR IGNORE INTO sort_runs VALUES(?,?)', (day, run.lower())).rowcount == 1
            if added:
                db.execute('UPDATE sort_totals SET total=total+1 WHERE id=1')
            db.execute('DELETE FROM sort_runs WHERE day < ?', (day,))
            total = db.execute('SELECT total FROM sort_totals WHERE id=1').fetchone()[0]
        return jsonify(recorded=added, total=total)
    finally:
        db.close()


# All Twitch credentials and OAuth tokens stay in this process.
TWITCH_CHANNEL = 'tezzzzaa'
_twitch_lock = threading.Lock()
_twitch_cache = {'until': 0, 'data': {'status': 'unknown'}}
_twitch_token = {'value': '', 'until': 0}


def twitch_json(url, data=None, headers=None):
    req = Request(url, data=data, headers=headers or {})
    with urlopen(req, timeout=3) as response:
        return json.loads(response.read(65536))


def twitch_access_token(client_id, secret):
    if _twitch_token['value'] and time.monotonic() < _twitch_token['until']:
        return _twitch_token['value']
    payload = urlencode({'client_id': client_id, 'client_secret': secret, 'grant_type': 'client_credentials'}).encode()
    data = twitch_json('https://id.twitch.tv/oauth2/token', data=payload,
                       headers={'Content-Type': 'application/x-www-form-urlencoded'})
    token = data.get('access_token')
    if not isinstance(token, str) or not token:
        raise ValueError('Invalid Twitch token response')
    _twitch_token.update(value=token, until=time.monotonic() + max(0, int(data['expires_in']) - 60))
    return token


@app.get('/api/twitch')
def twitch_status():
    client_id = os.environ.get('TWITCH_CLIENT_ID', '')
    secret = os.environ.get('TWITCH_CLIENT_SECRET', '')
    if not client_id or not secret:
        return jsonify(status='unknown')
    if time.monotonic() < _twitch_cache['until']:
        return jsonify(_twitch_cache['data'])
    # Don't let multiple visitors trigger a burst of upstream requests.
    if not _twitch_lock.acquire(blocking=False):
        return jsonify(status='unknown')
    try:
        if time.monotonic() < _twitch_cache['until']:
            return jsonify(_twitch_cache['data'])
        try:
            for attempt in range(2):
                token = twitch_access_token(client_id, secret)
                try:
                    result = twitch_json('https://api.twitch.tv/helix/streams?user_login=' + TWITCH_CHANNEL,
                                         headers={'Client-ID': client_id, 'Authorization': 'Bearer ' + token})
                    break
                except HTTPError as error:
                    if error.code != 401 or attempt:
                        raise
                    _twitch_token.update(value='', until=0)
            streams = result.get('data')
            if not isinstance(streams, list):
                raise ValueError('Invalid Twitch streams response')
            if streams:
                stream = streams[0]
                if stream.get('user_login', '').lower() != TWITCH_CHANNEL or stream.get('type') != 'live':
                    raise ValueError('Unexpected Twitch stream')
                data = {'status': 'live', 'title': str(stream.get('title', ''))[:300],
                        'category': str(stream.get('game_name', ''))[:200],
                        'viewers': max(0, int(stream.get('viewer_count', 0)))}
            else:
                data = {'status': 'offline'}
            ttl = 60
        except Exception:
            # Never expose credentials, upstream errors, or stale live claims.
            data = {'status': 'unknown'}
            ttl = 30
        _twitch_cache.update(until=time.monotonic() + ttl, data=data)
        return jsonify(data)
    finally:
        _twitch_lock.release()
