"""The desktop UI is precompiled and self-hosted without weakening CSP."""
from pathlib import Path
import json


def test_dashboard_loads_precompiled_vue_entry(h):
    result = h.client.get('/')
    assert result.status_code == 200
    assert 'id="admin-app"' in result.text
    assert 'type="module" src="/static/admin/admin.js"' in result.text
    assert '/static/admin/admin.css' in result.text
    assert 'unsafe-eval' not in result.headers['content-security-policy']
    assert 'unpkg.com' not in result.text and 'cdn.jsdelivr.net' not in result.text


def test_vue_bundle_and_styles_are_local_and_executable(h):
    script = h.client.get('/static/admin/admin.js')
    style = h.client.get('/static/admin/admin.css')
    assert script.status_code == style.status_code == 200
    assert script.headers['content-type'].split(';')[0] == 'text/javascript'
    assert style.headers['content-type'].startswith('text/css')
    assert script.headers['x-content-type-options'] == 'nosniff'
    assert len(script.content) > 20000
    assert 'status-stack' in style.text and 'pack-device-field' in style.text


def test_signing_worker_and_key_store_remain_same_origin(h):
    for path in ['pack-ui.mjs','pack-worker.mjs','pack-core.mjs','pack-keystore.mjs','retention-ui.mjs']:
        result = h.client.get('/static/' + path)
        assert result.status_code == 200
        assert 'unsafe-inline' not in result.headers['content-security-policy']


def test_vue_sources_and_locked_dependencies_are_present():
    root = Path(__file__).resolve().parents[1]
    package = json.loads((root / 'frontend/package.json').read_text(encoding='utf-8'))
    lock = json.loads((root / 'frontend/package-lock.json').read_text(encoding='utf-8'))
    assert package['dependencies']['vue'] == lock['packages']['']['dependencies']['vue']
    for view in ['Overview','Products','Devices','Artifacts','Releases','Attempts']:
        source = (root / f'frontend/src/views/{view}.vue').read_text(encoding='utf-8')
        assert '<template>' in source and 'v-html' not in source


def test_vue_entry_does_not_expose_management_over_lan(h):
    # Session authentication still applies to the actual dashboard entry.
    h.client.cookies.clear()
    result = h.client.get('/', follow_redirects=False)
    assert result.status_code == 303 and result.headers['location'] == '/login'


def test_login_shares_self_hosted_workbench_style(h):
    h.client.cookies.clear()
    result = h.client.get('/login')
    assert result.status_code == 200
    assert '/static/admin/admin.css' in result.text
    assert 'login-wordmark' in result.text and '欢迎回来' in result.text
    assert 'unsafe-inline' not in result.headers['content-security-policy']
