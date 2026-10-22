import tempfile
import unittest
import uuid
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import app as collector

class SorterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        collector.DATABASE = str(Path(self.temp.name) / 'stats.sqlite3')
        collector.PUBLIC_ORIGIN = 'https://labs.example.com'
        self.headers = {'Origin': collector.PUBLIC_ORIGIN}
        self.payload = {'run': str(uuid.uuid4()), 'day': datetime.now(timezone.utc).date().isoformat()}
        self.client = collector.app.test_client()
    def tearDown(self): self.temp.cleanup()
    def post(self, payload=None):
        return self.client.post('/api/sorts/complete', json=payload or self.payload, headers=self.headers)
    def test_deduplication_persistence_and_visitors(self):
        self.assertEqual(self.client.get('/api/sorts').json['total'], 0)
        self.assertTrue(self.post().json['recorded'])
        self.assertFalse(self.post().json['recorded'])
        upper = {**self.payload, 'run': self.payload['run'].upper()}
        self.assertFalse(self.post(upper).json['recorded'])
        self.assertEqual(collector.app.test_client().get('/api/sorts').json['total'], 1)
        self.assertEqual(self.client.get('/api/visitors').json['total'], 0)
    def test_rejects_invalid_requests(self):
        self.assertEqual(self.client.post('/api/sorts/complete', json=self.payload).status_code, 403)
        self.assertEqual(self.post({**self.payload, 'run': 'bad'}).status_code, 400)
        self.assertEqual(self.post({**self.payload, 'day': '2000-01-01'}).status_code, 400)
        self.assertEqual(self.client.post('/api/sorts/complete', data='x'*300, content_type='application/json', headers=self.headers).status_code, 413)
    def test_concurrent_retries_only_count_once(self):
        collector.connect().close()
        def post(_):
            with collector.app.test_client() as client:
                return client.post('/api/sorts/complete', json=self.payload, headers=self.headers).json['recorded']
        with ThreadPoolExecutor(max_workers=4) as pool:
            self.assertEqual(sum(pool.map(post, range(8))), 1)
        self.assertEqual(self.client.get('/api/sorts').json['total'], 1)
    def test_cleanup_preserves_lifetime_count(self):
        db = collector.connect()
        with db:
            db.execute("INSERT INTO sort_runs VALUES('2000-01-01','old')")
            db.execute('UPDATE sort_totals SET total=4')
        db.close()
        self.assertEqual(self.post().json['total'], 5)
        db = collector.connect()
        self.assertEqual(db.execute('SELECT count(*) FROM sort_runs').fetchone()[0], 1)
        db.close()
