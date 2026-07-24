from tests.conftest import create_counter


def test_create_and_list_counters(auth_client):
    counter = create_counter(auth_client, name="Push-ups", step=5, target=50)
    assert counter["name"] == "Push-ups"
    assert counter["step"] == 5
    assert counter["value"] == 0

    response = auth_client.get("/api/counters")
    assert response.status_code == 200
    assert len(response.get_json()["counters"]) == 1


def test_create_counter_validation(auth_client):
    response = auth_client.post("/api/counters", json={"name": ""})
    assert response.status_code == 400

    response = auth_client.post("/api/counters", json={"name": "Ok", "step": 0})
    assert response.status_code == 400

    response = auth_client.post("/api/counters", json={"name": "Ok", "color": "red"})
    assert response.status_code == 400


def test_increment_and_clamp_at_zero(auth_client):
    counter = create_counter(auth_client, step=3)
    cid = counter["id"]

    response = auth_client.post(f"/api/counters/{cid}/increment", json={})
    data = response.get_json()
    assert data["counter"]["value"] == 3
    assert data["applied_delta"] == 3

    response = auth_client.post(f"/api/counters/{cid}/increment", json={"delta": -10})
    data = response.get_json()
    assert data["counter"]["value"] == 0
    assert data["applied_delta"] == -3  # clamped: never below zero


def test_reset_counter(auth_client):
    counter = create_counter(auth_client)
    cid = counter["id"]
    auth_client.post(f"/api/counters/{cid}/increment", json={"delta": 7})

    response = auth_client.post(f"/api/counters/{cid}/reset")
    assert response.get_json()["counter"]["value"] == 0

    history = auth_client.get(f"/api/counters/{cid}/history").get_json()
    assert history["events"][0]["delta"] == -7  # reset event is logged


def test_update_counter(auth_client):
    counter = create_counter(auth_client)
    cid = counter["id"]

    response = auth_client.patch(
        f"/api/counters/{cid}", json={"name": "Renamed", "target": None}
    )
    data = response.get_json()["counter"]
    assert data["name"] == "Renamed"
    assert data["target"] is None


def test_delete_counter(auth_client):
    counter = create_counter(auth_client)
    response = auth_client.delete(f"/api/counters/{counter['id']}")
    assert response.status_code == 200

    response = auth_client.get("/api/counters")
    assert response.get_json()["counters"] == []


def test_counters_are_isolated_between_users(auth_client, client):
    counter = create_counter(auth_client)

    # Second user must not see or modify the first user's counter.
    auth_client.post("/auth/logout")
    client.post(
        "/auth/register",
        data={"email": "b@b.com", "username": "mallory", "password": "password123"},
    )
    response = client.get("/api/counters")
    assert response.get_json()["counters"] == []

    response = client.post(f"/api/counters/{counter['id']}/increment", json={})
    assert response.status_code == 404


def test_stats_overview(auth_client):
    counter = create_counter(auth_client)
    auth_client.post(f"/api/counters/{counter['id']}/increment", json={"delta": 4})

    response = auth_client.get("/api/stats/overview")
    data = response.get_json()
    assert data["counters"] == 1
    assert data["today_total"] == 4
    assert data["current_streak"] == 1
    assert data["best_streak"] == 1
    assert len(data["daily"]) == 14
    assert data["daily"][-1]["total"] == 4
