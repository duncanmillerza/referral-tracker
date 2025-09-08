# referral-tracker

## Deploying to Vercel

Set the following Environment Variables in your Vercel project (Project → Settings → Environment Variables). Add them for Production, Preview, and Development as needed.

- SHEET_ID: Google Sheets document ID (the long ID in the sheet URL)
- GOOGLE_CREDENTIALS: Entire contents of your Google service account JSON
- DEPT_CODES (optional): JSON map of department → PIN for lightweight validation

Example values:

- SHEET_ID: 18b5tDHMLivTHYVEi9yXXzvUQxy2ycUa_cDLBD5xgAB4
- GOOGLE_CREDENTIALS: {"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...",...}
- DEPT_CODES: {"Cardiology":"1234","Emergency":"5678"}

Notes:

- Leave `DEPT_CODES` unset if you don’t want PIN validation. If set, `api/get_referrals` will validate requests with headers `x-dept-name` and `x-dept-pin`. If valid and no `department` query is provided, it defaults to the header department.
- The code reads these variables via `os.environ['SHEET_ID']`, `os.environ['GOOGLE_CREDENTIALS']`, and optional `os.environ.get('DEPT_CODES')`.

## Local development

You can create a local `.env` or `.env.local` based on `.env.example`. For `GOOGLE_CREDENTIALS`, use a compact, single-line JSON string. A couple of ways to generate it:

- With jq: `jq -c . service-account.json`
- With Python: `python -c "import json;print(json.dumps(json.load(open('service-account.json'))))"`

Alternatively, export from the file directly in your shell for a one-off session:

```sh
export SHEET_ID="<your_sheet_id>"
export GOOGLE_CREDENTIALS="$(cat service-account.json)"
```

Run the simple dev server (serves static files and routes /api/*):

```sh
python dev_server.py
```

Then open http://localhost:8000
