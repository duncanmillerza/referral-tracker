import json
import os

from api.auth import verify_password, load_users, create_session, set_cookie_header


def handler(request):
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
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'})
        }

    try:
        data = json.loads(request.body or '{}')
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''
        if not username or not password:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Username and password required'})
            }

        if not verify_password(password):
            return {
                'statusCode': 401,
                'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Invalid credentials'})
            }

        users = load_users()
        profile = users.get(username)
        if not profile or not isinstance(profile, dict):
            return {
                'statusCode': 401,
                'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Unknown user'})
            }

        session = create_session({
            'u': username,
            'name': profile.get('name') or username,
            'department': profile.get('department') or ''
        })
        set_cookie = set_cookie_header(session)

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
                'Set-Cookie': set_cookie
            },
            'body': json.dumps({'success': True, 'profile': {
                'username': username,
                'name': profile.get('name') or username,
                'department': profile.get('department') or ''
            }})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'success': False, 'error': str(e)})
        }

