import os
import json
from typing import Optional, Tuple
from http import cookies

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from passlib.hash import bcrypt


SESSION_COOKIE = "session"
SESSION_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _get_secret() -> str:
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        # Fallback weak default for local dev only
        secret = "dev-secret-change-me"
    return secret


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_get_secret(), salt="referral-tracker-session")


def verify_password(passphrase: str) -> bool:
    hashed = os.environ.get("APP_PASSWORD_BCRYPT")
    if not hashed:
        return False
    try:
        return bcrypt.verify(passphrase, hashed)
    except Exception:
        return False


def load_users() -> dict:
    # USERS env: {"alice": {"name": "Dr Alice", "department": "Cardiology"}, ...}
    raw = os.environ.get("USERS", "{}")
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def create_session(payload: dict) -> str:
    s = _serializer()
    return s.dumps(payload or {})


def parse_session(token: str) -> Optional[dict]:
    s = _serializer()
    try:
        return s.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def get_session_from_request(request) -> Optional[dict]:
    header = None
    try:
        header = request.headers.get('Cookie') if hasattr(request, 'headers') else None
    except Exception:
        header = None
    if not header:
        return None
    try:
        c = cookies.SimpleCookie()
        c.load(header)
        morsel = c.get(SESSION_COOKIE)
        if not morsel:
            return None
        return parse_session(morsel.value)
    except Exception:
        return None


def set_cookie_header(value: str, max_age: int = SESSION_MAX_AGE) -> str:
    # Build a Set-Cookie header string
    c = cookies.SimpleCookie()
    c[SESSION_COOKIE] = value
    c[SESSION_COOKIE]["Path"] = "/"
    c[SESSION_COOKIE]["HttpOnly"] = True
    c[SESSION_COOKIE]["SameSite"] = "Lax"
    # Secure only on prod (Vercel will be HTTPS). Always set Secure.
    c[SESSION_COOKIE]["Secure"] = True
    c[SESSION_COOKIE]["Max-Age"] = max_age
    return c.output(header='').strip()


def clear_cookie_header() -> str:
    c = cookies.SimpleCookie()
    c[SESSION_COOKIE] = ''
    c[SESSION_COOKIE]["Path"] = "/"
    c[SESSION_COOKIE]["HttpOnly"] = True
    c[SESSION_COOKIE]["SameSite"] = "Lax"
    c[SESSION_COOKIE]["Secure"] = True
    c[SESSION_COOKIE]["Max-Age"] = 0
    return c.output(header='').strip()


def require_auth(request) -> Tuple[Optional[dict], Optional[dict]]:
    sess = get_session_from_request(request)
    if not sess:
        return None, {
            'statusCode': 401,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'success': False, 'error': 'Unauthorized'})
        }
    return sess, None

