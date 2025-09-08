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
                'Access-Control-Allow-Headers': 'Content-Type, X-Dept-Name, X-Dept-Pin, X-Clinician-Name'
            }
        }
    
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        data = json.loads(request.body)
        headers = getattr(request, 'headers', {}) or {}
        headers_norm = {str(k).lower(): v for k, v in headers.items()}
        
        # Required fields for updating referral
        # Allow header fallback for clinician_seen
        if not data.get('clinician_seen'):
            data['clinician_seen'] = headers_norm.get('x-clinician-name') or data.get('clinician_seen')

        required_fields = ['row_number', 'clinician_seen']
        for field in required_fields:
            if field not in data:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': f'Missing required field: {field}'})
                }
        
        # Set up Google Sheets connection
        credentials_json = json.loads(os.environ['GOOGLE_CREDENTIALS'])
        credentials = Credentials.from_service_account_info(credentials_json).with_scopes(SCOPES)
        gc = gspread.authorize(credentials)
        sheet = gc.open_by_key(os.environ['SHEET_ID']).sheet1
        
        # Update the specific row
        row_num = data['row_number']  # This should be the actual row number in the sheet
        time_seen = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Update columns J, K, L (Clinician Seen, Time Seen, Clinician Notes)
        sheet.update_cell(row_num, 10, data['clinician_seen'])  # Column J
        sheet.update_cell(row_num, 11, time_seen)               # Column K
        sheet.update_cell(row_num, 12, data.get('clinician_notes', ''))  # Column L
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Referral updated successfully',
                'time_seen': time_seen
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
