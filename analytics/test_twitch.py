import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import app as collector

class TwitchTests(unittest.TestCase):
    def setUp(self):
        collector._twitch_cache.update(until=0, data={'status':'unknown'})
        collector._twitch_token.update(value='', until=0)
        self.client = collector.app.test_client()
        self.env = patch.dict(collector.os.environ, {'TWITCH_CLIENT_ID':'test-id', 'TWITCH_CLIENT_SECRET':'test-secret'})
        self.env.start()
    def tearDown(self): self.env.stop()
    def test_missing_configuration_never_claims_offline(self):
        with patch.dict(collector.os.environ, {'TWITCH_CLIENT_SECRET':''}), patch.object(collector, 'twitch_json') as network:
            self.assertEqual(self.client.get('/api/twitch').json, {'status':'unknown'})
            network.assert_not_called()
    def test_live_is_sanitized_and_cached(self):
        stream = {'user_login':'tezzzzaa', 'type':'live', 'title':'Hello <world>', 'game_name':'Minecraft', 'viewer_count':42, 'private':'not-returned'}
        with patch.object(collector, 'twitch_json', side_effect=[{'access_token':'secret-token','expires_in':3600}, {'data':[stream]}]) as network:
            first = self.client.get('/api/twitch')
            second = self.client.get('/api/twitch')
            self.assertEqual(first.json, {'status':'live','title':'Hello <world>','category':'Minecraft','viewers':42})
            self.assertEqual(first.json, second.json)
            self.assertEqual(network.call_count, 2)
            self.assertNotIn('secret', first.get_data(as_text=True))
    def test_offline_and_token_reuse(self):
        with patch.object(collector, 'twitch_json', side_effect=[{'access_token':'token','expires_in':3600}, {'data':[]}, {'data':[]}]) as network:
            self.assertEqual(self.client.get('/api/twitch').json['status'], 'offline')
            collector._twitch_cache['until'] = 0
            self.assertEqual(self.client.get('/api/twitch').json['status'], 'offline')
            self.assertEqual(network.call_count, 3)
    def test_failure_clears_stale_live_and_is_cached(self):
        collector._twitch_cache['data'] = {'status':'live'}
        with patch.object(collector, 'twitch_json', side_effect=TimeoutError('secret')) as network:
            self.assertEqual(self.client.get('/api/twitch').json, {'status':'unknown'})
            self.assertEqual(self.client.get('/api/twitch').json, {'status':'unknown'})
            self.assertEqual(network.call_count, 1)
    def test_revoked_token_is_renewed_once(self):
        collector._twitch_token.update(value='expired', until=float('inf'))
        responses = [HTTPError('https://api.twitch.tv',401,'Unauthorized',None,None), {'access_token':'fresh','expires_in':3600}, {'data':[]}]
        with patch.object(collector, 'twitch_json', side_effect=responses) as network:
            self.assertEqual(self.client.get('/api/twitch').json['status'], 'offline')
            self.assertEqual(network.call_count, 3)
    def test_malformed_response_is_unknown(self):
        with patch.object(collector, 'twitch_json', side_effect=[{'access_token':'token','expires_in':3600}, {'unexpected':[]} ]):
            self.assertEqual(self.client.get('/api/twitch').json, {'status':'unknown'})
