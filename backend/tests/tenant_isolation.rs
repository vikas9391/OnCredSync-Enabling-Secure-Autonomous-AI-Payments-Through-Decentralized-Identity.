use sqlx::{mysql::MySqlPoolOptions, MySqlPool};
use uuid::Uuid;

async fn setup_database() -> MySqlPool {
    let url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must point to a disposable MySQL test database");
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .expect("connect to test MySQL");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("apply migrations to test database");
    pool
}

#[tokio::test]
async fn database_rejects_cross_workspace_agent_links() {
    let pool = setup_database().await;
    let workspace_a = Uuid::new_v4().to_string();
    let workspace_b = Uuid::new_v4().to_string();
    let agent_b = Uuid::new_v4().to_string();

    for (id, name) in [(&workspace_a, "Tenant A isolation test"), (&workspace_b, "Tenant B isolation test")] {
        sqlx::query("INSERT INTO workspaces (id, name) VALUES (?, ?)")
            .bind(id)
            .bind(name)
            .execute(&pool)
            .await
            .expect("create test workspace");
    }

    sqlx::query("INSERT INTO agents (id, workspace_id, name, owner, did, network) VALUES (?, ?, 'Test agent', 'Test owner', ?, 'Base Sepolia')")
        .bind(&agent_b)
        .bind(&workspace_b)
        .bind(format!("did:oncredsync:{agent_b}"))
        .execute(&pool)
        .await
        .expect("create agent in workspace B");

    let policy_result = sqlx::query(
        "INSERT INTO spending_policies (id, workspace_id, agent_id, name, transaction_limit_wei, daily_limit_wei, approved_merchants) VALUES (?, ?, ?, 'Isolation test', 1000000000000000, 2000000000000000, JSON_ARRAY('test.example'))"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&workspace_a)
    .bind(&agent_b)
    .execute(&pool)
    .await;
    assert!(policy_result.is_err(), "a workspace A policy must not reference a workspace B agent");

    let payment_result = sqlx::query(
        "INSERT INTO payments (id, workspace_id, agent_id, merchant, purpose, amount_wei, status, protocol) VALUES (?, ?, ?, 'test.example', 'Isolation test', 1, 'pending', 'demo')"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&workspace_a)
    .bind(&agent_b)
    .execute(&pool)
    .await;
    assert!(payment_result.is_err(), "a workspace A payment must not reference a workspace B agent");

    sqlx::query("DELETE FROM agents WHERE id = ? AND workspace_id = ?")
        .bind(&agent_b)
        .bind(&workspace_b)
        .execute(&pool)
        .await
        .expect("remove test agent");
    sqlx::query("DELETE FROM workspaces WHERE id IN (?, ?)")
        .bind(&workspace_a)
        .bind(&workspace_b)
        .execute(&pool)
        .await
        .expect("remove test workspaces");
}
