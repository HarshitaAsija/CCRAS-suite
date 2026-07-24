import urllib.request
import urllib.error

req = urllib.request.Request(
    'http://localhost:8002/api/v1/study-design/export-docx', 
    data=b'{"state": {}}', 
    headers={'Content-Type': 'application/json'}, 
    method='POST'
)

try:
    print(urllib.request.urlopen(req).read())
except urllib.error.HTTPError as e:
    print('ERROR:', e.read().decode('utf-8'))
