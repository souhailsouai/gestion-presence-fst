import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_auth_contract_has_only_primary_credentials():
    data = json.loads((ROOT / "shared/auth-contract.json").read_text(encoding="utf-8"))
    assert data["credential_modes"] == ["pin", "password"]
    assert "MFA_REQUIRED" not in data["errors"]
    assert data["session_fields"] == ["access_token", "refresh_token", "expires_in", "user_id", "role"]


def test_migration_removes_mfa_business_contract():
    sql = (ROOT / "supabase/migrations/20260831_remove_mfa_business_gate.sql").read_text(encoding="utf-8").lower()
    assert "auth.uid() is not null" in sql
    assert "'mfa_required', false" in sql
    assert "delete from public.app_config where key = 'mfa_policy'" in sql
    assert "current_aal" not in sql
    assert "aal2" not in sql
