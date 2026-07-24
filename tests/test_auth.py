def test_register_and_login_flow(client):
    response = client.post(
        "/auth/register",
        data={"email": "a@b.com", "username": "alice", "password": "password123"},
    )
    assert response.status_code == 302  # redirected to dashboard

    client.post("/auth/logout")

    response = client.post(
        "/auth/login",
        data={"identity": "alice", "password": "password123"},
    )
    assert response.status_code == 302

    response = client.get("/dashboard")
    assert response.status_code == 200


def test_register_rejects_short_password(client):
    response = client.post(
        "/auth/register",
        data={"email": "a@b.com", "username": "alice", "password": "short"},
    )
    assert response.status_code == 400


def test_register_rejects_duplicate_email(client):
    data = {"email": "a@b.com", "username": "alice", "password": "password123"}
    client.post("/auth/register", data=data)
    client.post("/auth/logout")

    response = client.post(
        "/auth/register",
        data={"email": "a@b.com", "username": "bob", "password": "password123"},
    )
    assert response.status_code == 400


def test_login_with_wrong_password_fails(client):
    client.post(
        "/auth/register",
        data={"email": "a@b.com", "username": "alice", "password": "password123"},
    )
    client.post("/auth/logout")

    response = client.post(
        "/auth/login",
        data={"identity": "alice", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_dashboard_requires_login(client):
    response = client.get("/dashboard")
    assert response.status_code == 302
    assert "/auth/login" in response.headers["Location"]


def test_api_requires_login(client):
    response = client.get("/api/counters")
    assert response.status_code == 401 or response.status_code == 302
