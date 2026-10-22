"""Country-only visit aggregates. Run behind the supplied Nginx configuration."""
import hashlib
import json
import os
import re
import sqlite3
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
      CREATE TABLE IF NOT EXISTS sessions (day TEXT, token TEXT, PRIMARY KEY(day,token));
      CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, visits INTEGER NOT NULL);
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
        return jsonify(total=total, today=row[0] if row else 0, countries=countries, since=since)
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
            db.execute('DELETE FROM sessions WHERE day < ?',((now-timedelta(days=1)).isoformat(),))
            db.execute('DELETE FROM daily WHERE day < ?',((now-timedelta(days=400)).isoformat(),))
        return jsonify(recorded=added)
    finally:
        db.close()
