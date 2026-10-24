#!/usr/bin/env python3
"""Enter app credentials locally on the VM; never place them in the repository."""
import getpass
import os
from pathlib import Path
import re
import subprocess
if os.geteuid() != 0:
    raise SystemExit('Run with sudo python3 deploy/configure-twitch.py')
client_id = input('Twitch app Client ID: ').strip()
secret = getpass.getpass('Twitch app Client secret (hidden): ').strip()
if not all(re.fullmatch(r'[A-Za-z0-9_-]{10,200}', value) for value in (client_id, secret)):
    raise SystemExit('Invalid credential format; no files changed.')
path = Path('/etc/firehawk-twitch.env')
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as file:
    os.fchmod(file.fileno(), 0o600)
    file.write(f'TWITCH_CLIENT_ID={client_id}\nTWITCH_CLIENT_SECRET={secret}\n')
dropin = Path('/etc/systemd/system/firehawk-visitors.service.d')
dropin.mkdir(parents=True, exist_ok=True)
(dropin / 'twitch.conf').write_text('[Service]\nEnvironmentFile=/etc/firehawk-twitch.env\n')
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['systemctl', 'restart', 'firehawk-visitors'], check=True)
print('Credentials saved on this VM. Check /api/twitch for live or offline status.')
