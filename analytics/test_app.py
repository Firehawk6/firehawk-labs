import tempfile
import unittest
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import app as collector

class VisitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        collector.DATABASE = str(Path(self.temp.name)/'visits.sqlite3')
        collector.PUBLIC_ORIGIN = 'https://labs.example.com'
        self.client = collector.app.test_client()
        self.headers = {'Origin': collector.PUBLIC_ORIGIN, 'CF-IPCountry': 'US'}
    def tearDown(self): self.temp.cleanup()
    def post(self,session=None,headers=None):
        return self.client.post('/api/visitors/visit',json={'session':session or str(uuid.uuid4())},headers=self.headers if headers is None else headers)
    def test_refresh_deduplicates_and_get_does_not_count(self):
        token=str(uuid.uuid4())
        self.assertTrue(self.post(token).json['recorded'])
        self.assertFalse(self.post(token).json['recorded'])
        for _ in range(3):self.assertEqual(self.client.get('/api/visitors').json['total'],1)
        self.assertEqual(self.client.get('/api/visitors').json['countries'],[{'code':'US','count':1}])
    def test_origin_and_payload_validation(self):
        self.assertEqual(self.post(headers={'Origin':'https://elsewhere.example'}).status_code,403)
        self.assertEqual(self.post('bad-token').status_code,400)
        self.assertEqual(self.client.post('/api/visitors/visit',data='x'*300,headers={**self.headers,'Content-Type':'application/json'}).status_code,413)
    def test_unknown_country_never_invents_a_marker(self):
        self.post(headers={'Origin':collector.PUBLIC_ORIGIN,'CF-IPCountry':'XX'})
        stats=self.client.get('/api/visitors')
        self.assertEqual(stats.json['total'],1)
        self.assertEqual(stats.json['countries'],[])
        self.assertEqual(stats.headers['Cache-Control'],'no-store')
    def test_concurrent_same_session_records_once(self):
        collector.connect().close()
        token=str(uuid.uuid4())
        def visit(_):
            with collector.app.test_client() as client:
                return client.post('/api/visitors/visit',json={'session':token},headers=self.headers).json['recorded']
        with ThreadPoolExecutor(max_workers=4) as pool:self.assertEqual(sum(pool.map(visit,range(8))),1)
        self.assertEqual(self.client.get('/api/visitors').json['total'],1)
    def test_country_totals_and_private_storage(self):
        self.post()
        self.post(headers={'Origin':collector.PUBLIC_ORIGIN,'CF-IPCountry':'GB'})
        data=self.client.get('/api/visitors').json
        self.assertEqual(data['total'],2)
        self.assertEqual(data['today'],2)
        self.assertEqual(len(data['countries']),2)
        db=collector.connect()
        self.assertEqual([r[1] for r in db.execute('PRAGMA table_info(sessions)')],['day','token'])
        db.close()

if __name__=='__main__': unittest.main()
