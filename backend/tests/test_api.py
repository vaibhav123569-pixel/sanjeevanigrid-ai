import asyncio

import httpx

from backend.app import main

async def request(method: str, path: str, **kwargs):
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, path, **kwargs)


def call(method: str, path: str, **kwargs):
    return asyncio.run(request(method, path, **kwargs))


def test_health_discloses_demo_mode(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    response = call("GET", "/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["gemini_configured"] is False
    assert body["data_source"] == "SIMULATION"
    assert "not an emergency service" in body["disclaimer"]


def test_gemini_absence_returns_transparent_unavailable(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    response = call("POST", "/api/extract-report", json={"transcript": "A road is flooded."})
    assert response.status_code == 503
    assert "not analyzed by AI" in response.json()["detail"]


def test_image_format_is_checked_before_model_call(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    response = call("POST", "/api/analyze-image", files={"image": ("road.gif", b"GIF89a", "image/gif")})
    assert response.status_code == 415


def test_configured_api_requires_firebase_id_token(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "example-project")
    response = call("POST", "/api/extract-report", json={"transcript": "A road is flooded."})
    assert response.status_code == 401


def test_assistant_rejects_uncontrolled_application_fields(monkeypatch):
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    payload = {
        "question": "Which village is at risk?",
        "application_data": {
            "scenario": {"stage": 0, "label": "Normal conditions", "dataSource": "SIMULATION"},
            "villages": [], "facilities": [],
            "reportSummary": {"pending": 0, "verified": 0, "approved": 0, "byType": {}},
            "private_report_text": "should be rejected",
        },
    }
    assert call("POST", "/api/assistant", json=payload).status_code == 422
