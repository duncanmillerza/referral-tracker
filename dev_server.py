#!/usr/bin/env python3
import json
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# Import API handlers
from api.submit_referral import handler as submit_handler
from api.get_referrals import handler as get_handler
from api.update_referral import handler as update_handler


class RequestWrapper:
    def __init__(self, method, body, args, headers):
        self.method = method
        self.body = body
        self.args = args
        self.headers = headers


def call_api_handler(path, method, body, query_params, headers):
    request = RequestWrapper(method=method, body=body, args=query_params, headers=headers)

    if path == "/api/submit_referral":
        return submit_handler(request)
    elif path == "/api/get_referrals":
        return get_handler(request)
    elif path == "/api/update_referral":
        return update_handler(request)
    else:
        return None


class DevHandler(SimpleHTTPRequestHandler):
    def _handle_api(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            return False

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else None
        query_params = {k: v[0] if isinstance(v, list) and v else v for k, v in parse_qs(parsed.query).items()}
        headers = {k: v for k, v in self.headers.items()}

        try:
            result = call_api_handler(path, self.command, body, query_params, headers)
            if result is None:
                self.send_error(404, "Not Found")
                return True

            status = result.get('statusCode', 200)
            resp_headers = result.get('headers', {})
            body_text = result.get('body', '')

            self.send_response(status)
            for k, v in resp_headers.items():
                self.send_header(k, v)
            # Ensure JSON content type if body present and not set
            if body_text and 'Content-Type' not in {k.title(): k for k in resp_headers.keys()}:
                self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if body_text:
                self.wfile.write(body_text.encode('utf-8'))
            return True
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return True

    def do_OPTIONS(self):
        if self._handle_api():
            return
        return super().do_OPTIONS()

    def do_GET(self):
        if self._handle_api():
            return
        return super().do_GET()

    def do_POST(self):
        if self._handle_api():
            return
        # If not an API route, return 404 instead of 501
        self.send_error(404, "Not Found")


def ensure_env():
    # Auto-load service account if not set
    if 'GOOGLE_CREDENTIALS' not in os.environ and os.path.exists('service-account.json'):
        with open('service-account.json', 'r') as f:
            os.environ['GOOGLE_CREDENTIALS'] = f.read()
    # SHEET_ID must be set by the user for real API calls
    if 'SHEET_ID' not in os.environ:
        print("⚠️  SHEET_ID not set. Set it via environment to enable API calls.")


def run(port=8000):
    ensure_env()
    server_address = ('', port)
    httpd = HTTPServer(server_address, DevHandler)
    print(f"📟 Dev server running at http://localhost:{port}")
    print("   • Serves static files and routes /api/* to Python handlers")
    httpd.serve_forever()


if __name__ == '__main__':
    run()

