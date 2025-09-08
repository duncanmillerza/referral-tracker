import json
import os

def handler(request):
    # Lightweight health check for env + optional connectivity
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
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'})
        }

    present = {
        'SHEET_ID': bool(os.environ.get('SHEET_ID')),
        'GOOGLE_CREDENTIALS': bool(os.environ.get('GOOGLE_CREDENTIALS')),
        'DEPT_CODES': bool(os.environ.get('DEPT_CODES')),
    }

    details = {}
    # Do not leak secrets, only structure validation
    try:
        if os.environ.get('GOOGLE_CREDENTIALS'):
            import json as _json
            creds = _json.loads(os.environ['GOOGLE_CREDENTIALS'])
            details['google_credentials_fields'] = sorted(list(creds.keys()))[:5]
    except Exception as e:
        details['google_credentials_error'] = str(e)

    # Optionally test Sheets access if both envs present
    try:
        if present['SHEET_ID'] and present['GOOGLE_CREDENTIALS']:
            import gspread
            from google.oauth2.service_account import Credentials
            creds_info = json.loads(os.environ['GOOGLE_CREDENTIALS'])
            scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ]
            credentials = Credentials.from_service_account_info(creds_info).with_scopes(scopes)
            gc = gspread.authorize(credentials)
            sh = gc.open_by_key(os.environ['SHEET_ID'])
            _ = sh.title  # touches API; throws if unauthorized
            details['sheets_access'] = 'ok'
        else:
            details['sheets_access'] = 'skipped'
    except Exception as e:
        details['sheets_access'] = f'error: {e}'

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps({ 'success': True, 'env': present, 'details': details })
    }

