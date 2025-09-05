import json
import os
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
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        }
    
    if request.method != 'GET':
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Set up Google Sheets connection
        credentials_json = json.loads(os.environ['GOOGLE_CREDENTIALS'])
        credentials = Credentials.from_service_account_info(credentials_json).with_scopes(SCOPES)
        gc = gspread.authorize(credentials)
        sheet = gc.open_by_key(os.environ['SHEET_ID']).sheet1
        
        # Get all records and attach row numbers (header assumed at row 1)
        records_raw = sheet.get_all_records()
        records = [{**r, "_row_number": i + 2} for i, r in enumerate(records_raw)]
        
        # Optional filtering + header-based defaults
        headers = getattr(request, 'headers', {}) or {}
        headers_norm = {str(k).lower(): v for k, v in headers.items()}

        dept_filter = request.args.get('department')
        ward_filter = request.args.get('ward')
        status_filter = request.args.get('status')  # 'pending' or 'seen'

        # Lightweight dept PIN validation (optional)
        dept_codes = os.environ.get('DEPT_CODES')
        if dept_codes:
            try:
                mapping = json.loads(dept_codes)
                hdr_dept = headers_norm.get('x-dept-name')
                hdr_pin = headers_norm.get('x-dept-pin')
                if hdr_dept and hdr_pin:
                    expected = mapping.get(hdr_dept)
                    if expected is None or str(expected) != str(hdr_pin):
                        return {
                            'statusCode': 403,
                            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                            'body': json.dumps({'success': False, 'error': 'Invalid department PIN'})
                        }
                    # If valid and no explicit department filter, default to header department
                    if not dept_filter:
                        dept_filter = hdr_dept
            except Exception:
                # If DEPT_CODES invalid, ignore errors and proceed without validation
                pass

        if dept_filter:
            records = [r for r in records if r.get('Department To') == dept_filter]
        if ward_filter:
            records = [r for r in records if r.get('Ward') == ward_filter]
        if status_filter == 'pending':
            records = [r for r in records if not r.get('Clinician Seen')]
        elif status_filter == 'seen':
            records = [r for r in records if r.get('Clinician Seen')]
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'referrals': records,
                'count': len(records)
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
