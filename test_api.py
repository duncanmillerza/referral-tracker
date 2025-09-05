import json
import os
from datetime import datetime

# First, let's set up environment variables for local testing
# You'll need to replace these with your actual values
os.environ['SHEET_ID'] = '18b5tDHMLivTHYVEi9yXXzvUQxy2ycUa_cDLBD5xgAB4'

# Read your service account file and convert to JSON string
with open('service-account.json', 'r') as f:
    credentials_content = f.read()
os.environ['GOOGLE_CREDENTIALS'] = credentials_content

# Import your API functions
from api.submit_referral import handler as submit_handler
from api.get_referrals import handler as get_handler

# Mock request class
class MockRequest:
    def __init__(self, method, body=None, args=None):
        self.method = method
        self.body = body
        self.args = args or {}

# Test 1: Submit a referral
print("=== Testing Submit Referral ===")
test_referral = {
    'patient_surname': 'Smith',
    'ward': 'Ward 3A',
    'bed_number': '15',
    'referring_clinician': 'Dr. Johnson',
    'dept_from': 'Emergency',
    'dept_to': 'Cardiology',
    'urgency_level': 'High',
    'referral_notes': 'Patient presenting with chest pain, requires urgent cardiac assessment'
}

request = MockRequest('POST', json.dumps(test_referral))
response = submit_handler(request)
print("Response:", json.dumps(response, indent=2))

# Test 2: Get all referrals
print("\n=== Testing Get Referrals ===")
request = MockRequest('GET')
response = get_handler(request)
print("Response:", json.dumps(response, indent=2))

# Test 3: Get referrals filtered by department
print("\n=== Testing Get Referrals (Filtered by Department) ===")
request = MockRequest('GET', args={'department': 'Cardiology'})
response = get_handler(request)
print("Response:", json.dumps(response, indent=2))