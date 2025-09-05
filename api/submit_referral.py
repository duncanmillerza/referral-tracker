import json
import os
from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

def handler(request):
    # Handle CORS
    if request.method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        }

    if request.method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }

    try:
        # Parse body JSON
        data = json.loads(request.body or '{}')
        headers = getattr(request, 'headers', {}) or {}
        # Normalize header keys to lowercase for robustness
        headers_norm = {str(k).lower(): v for k, v in headers.items()}

        # Allow header fallback for clinician and department-from
        if not data.get('referring_clinician'):
            data['referring_clinician'] = headers_norm.get('x-clinician-name') or data.get('referring_clinician')
        if not data.get('dept_from'):
            data['dept_from'] = headers_norm.get('x-dept-name') or data.get('dept_from')

        required_fields = [
            'patient_surname', 'ward', 'bed_number', 'referring_clinician',
            'dept_from', 'dept_to', 'urgency_level', 'referral_notes'
        ]
        missing = [f for f in required_fields if not data.get(f)]
        if missing:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': f"Missing required fields: {', '.join(missing)}"})
            }

        # Set up Google Sheets connection with scopes
        credentials_json = json.loads(os.environ['GOOGLE_CREDENTIALS'])
        credentials = Credentials.from_service_account_info(credentials_json).with_scopes(SCOPES)
        gc = gspread.authorize(credentials)
        sheet = gc.open_by_key(os.environ['SHEET_ID']).sheet1

        # Compose row according to the sheet columns
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        row = [
            timestamp,
            data['patient_surname'],
            data['ward'],
            data['bed_number'],
            data['referring_clinician'],
            data['dept_from'],
            data['dept_to'],
            data['urgency_level'],
            data['referral_notes'],
            '',  # Clinician Seen
            '',  # Time Seen
            ''   # Clinician Notes
        ]

        sheet.append_row(row)

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Referral submitted successfully',
                'timestamp': timestamp
            })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
