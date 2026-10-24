import tempfile
import unittest
import uuid
from pathlib import Path
import app as collector

class LocationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        collector.DATABASE = str(Path(self.temp.name)/'test.sqlite3')
        collector.PUBLIC_ORIGIN = 'https://labs.example.com'
        self.client = collector.app.test_client()
    def tearDown(self): self.temp.cleanup()
    def visit(self, lat=None, lon=None, session=None, country='US', **body):
        headers = {'Origin':collector.PUBLIC_ORIGIN, 'CF-IPCountry':country}
        if lat is not None: headers['CF-IPLatitude'] = str(lat)
        if lon is not None: headers['CF-IPLongitude'] = str(lon)
        return self.client.post('/api/visitors/visit', headers=headers, json={'session':session or str(uuid.uuid4()), **body})
    def test_regional_rounding_and_deduplication(self):
        session = str(uuid.uuid4())
        self.visit(36.1627,-86.7816,session)
        self.visit(36.1627,-86.7816,session)
        self.visit(36.17,-86.8)
        self.visit(34.0522,-118.2437)
        data = self.client.get('/api/visitors').json
        self.assertEqual(data['total'],3)
        self.assertEqual(data['countries'],[{'code':'US','count':3}])
        self.assertEqual(data['locations'],[{'code':'US','lat':36.0,'lon':-87.0,'count':2},{'code':'US','lat':34.0,'lon':-118.0,'count':1}])
    def test_missing_bad_headers_and_body_locations_ignored(self):
        for lat,lon in [(None,None),('nan',0),(0,'inf'),(91,0),(0,-181),('',0)]:
            self.visit(lat,lon)
        self.visit(latitude=40,longitude=-70)
        self.visit(30,40,country='XX')
        data = self.client.get('/api/visitors').json
        self.assertEqual(data['total'],8)
        self.assertEqual(data['locations'],[])
    def test_old_totals_preserved_and_no_backfill(self):
        self.visit()
        self.visit(0,180)
        data = self.client.get('/api/visitors').json
        self.assertEqual(data['total'],2)
        self.assertEqual(data['locations'],[{'code':'US','lat':0.0,'lon':-180.0,'count':1}])
        db = collector.connect()
        self.assertEqual([r[1] for r in db.execute('PRAGMA table_info(locations)')],['country','lat','lon','visits'])
        db.close()
